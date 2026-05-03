param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "us-central1",
  [string]$ServiceName = "electai",
  [string]$FirestoreDatabaseId = "(default)",
  [switch]$SkipApiEnable
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not on PATH. Install Google Cloud CLI, then run this script again."
  }
}

function Read-DotEnv($Path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($name) {
      $values[$name] = $value
    }
  }

  return $values
}

function Get-DeployValue($Name, $DotEnvValues, [switch]$Required) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if (-not $value -and $DotEnvValues.ContainsKey($Name)) {
    $value = $DotEnvValues[$Name]
  }

  if ($Required -and -not $value) {
    throw "Missing required value: $Name. Add it to .env or set it in this shell before deploying."
  }

  return $value
}

function Ensure-Secret($ProjectId, $SecretName, $Value) {
  if (-not $Value) {
    return $false
  }

  $describeOutput = & gcloud secrets describe $SecretName --project $ProjectId --format "value(name)" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $describeOutput) {
    & gcloud secrets create $SecretName --project $ProjectId --replication-policy automatic | Out-Null
  }

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    Set-Content -LiteralPath $tempFile -Value $Value -NoNewline -Encoding UTF8
    & gcloud secrets versions add $SecretName --project $ProjectId --data-file $tempFile | Out-Null
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }

  return $true
}

Require-Command "gcloud"

$dotEnv = Read-DotEnv ".env"
$geminiApiKey = Get-DeployValue "GEMINI_API_KEY" $dotEnv -Required
$civicApiKey = Get-DeployValue "GOOGLE_CIVIC_API_KEY" $dotEnv
if (-not $civicApiKey) {
  $civicApiKey = Get-DeployValue "VITE_GOOGLE_CIVIC_API_KEY" $dotEnv
}
if (-not $civicApiKey) {
  throw "Missing required value: GOOGLE_CIVIC_API_KEY. Add it to .env or set it in this shell before deploying."
}
$speechApiKey = Get-DeployValue "SPEECH_TO_TEXT_API" $dotEnv
$googleCredentialsJson = Get-DeployValue "GOOGLE_APPLICATION_CREDENTIALS_JSON" $dotEnv
$firebaseServiceAccountJson = Get-DeployValue "FIREBASE_SERVICE_ACCOUNT_JSON" $dotEnv
$geocodingApiKey = Get-DeployValue "GOOGLE_GEOCODING_API_KEY" $dotEnv
$mapsApiKey = Get-DeployValue "GOOGLE_MAPS_API_KEY" $dotEnv
$geminiModel = Get-DeployValue "GEMINI_MODEL" $dotEnv
if (-not $geminiModel) {
  $geminiModel = "gemini-2.5-flash"
}

if (-not $speechApiKey -and -not $googleCredentialsJson) {
  Write-Warning "No SPEECH_TO_TEXT_API or GOOGLE_APPLICATION_CREDENTIALS_JSON was found. Browser speech may still work, but server Speech-to-Text fallback will be unavailable."
}

& gcloud config set project $ProjectId | Out-Null

if (-not $SkipApiEnable) {
  & gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    secretmanager.googleapis.com `
    firestore.googleapis.com `
    civicinfo.googleapis.com `
    speech.googleapis.com `
    --project $ProjectId | Out-Null

  if ($geocodingApiKey -or $mapsApiKey) {
    & gcloud services enable geocoding-backend.googleapis.com --project $ProjectId | Out-Null
  }
}

$secretMap = @(
  @{ Env = "GEMINI_API_KEY"; Secret = "electai-gemini-api-key"; Value = $geminiApiKey },
  @{ Env = "GOOGLE_CIVIC_API_KEY"; Secret = "electai-google-civic-api-key"; Value = $civicApiKey },
  @{ Env = "SPEECH_TO_TEXT_API"; Secret = "electai-speech-to-text-api"; Value = $speechApiKey },
  @{ Env = "GOOGLE_APPLICATION_CREDENTIALS_JSON"; Secret = "electai-google-application-credentials-json"; Value = $googleCredentialsJson },
  @{ Env = "FIREBASE_SERVICE_ACCOUNT_JSON"; Secret = "electai-firebase-service-account-json"; Value = $firebaseServiceAccountJson },
  @{ Env = "GOOGLE_GEOCODING_API_KEY"; Secret = "electai-google-geocoding-api-key"; Value = $geocodingApiKey },
  @{ Env = "GOOGLE_MAPS_API_KEY"; Secret = "electai-google-maps-api-key"; Value = $mapsApiKey }
)

$secretArgs = @()
foreach ($item in $secretMap) {
  if (Ensure-Secret $ProjectId $item.Secret $item.Value) {
    $secretArgs += "$($item.Env)=$($item.Secret):latest"
  }
}

$projectNumber = & gcloud projects describe $ProjectId --format "value(projectNumber)"
$runtimeServiceAccount = "$projectNumber-compute@developer.gserviceaccount.com"

& gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/secretmanager.secretAccessor" `
  --quiet | Out-Null

& gcloud projects add-iam-policy-binding $ProjectId `
  --member "serviceAccount:$runtimeServiceAccount" `
  --role "roles/datastore.user" `
  --quiet | Out-Null

if ($googleCredentialsJson -or (-not $speechApiKey)) {
  & gcloud projects add-iam-policy-binding $ProjectId `
    --member "serviceAccount:$runtimeServiceAccount" `
    --role "roles/speech.client" `
    --quiet | Out-Null
}

$envVars = "FIRESTORE_DATABASE_ID=$FirestoreDatabaseId,GEMINI_MODEL=$geminiModel,NEXT_TELEMETRY_DISABLED=1"
$deployArgs = @(
  "run", "deploy", $ServiceName,
  "--project", $ProjectId,
  "--region", $Region,
  "--source", ".",
  "--allow-unauthenticated",
  "--port", "8080",
  "--set-env-vars", $envVars
)

if ($secretArgs.Count -gt 0) {
  $deployArgs += @("--set-secrets", ($secretArgs -join ","))
}

& gcloud @deployArgs

$serviceUrl = & gcloud run services describe $ServiceName `
  --project $ProjectId `
  --region $Region `
  --format "value(status.url)"

Write-Host ""
Write-Host "Deployed ELECTAI to Cloud Run:" -ForegroundColor Green
Write-Host $serviceUrl
Write-Host ""
Write-Host "Next step: add this domain to Firebase Authentication authorized domains if Google or Guest sign-in is blocked."
