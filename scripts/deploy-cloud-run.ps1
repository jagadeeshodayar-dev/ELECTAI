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

function Merge-DotEnv($Paths) {
  $values = @{}
  foreach ($path in $Paths) {
    $fileValues = Read-DotEnv $path
    foreach ($key in $fileValues.Keys) {
      $values[$key] = $fileValues[$key]
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

function Get-DeployValueFromAliases($Names, $DotEnvValues, [switch]$Required) {
  foreach ($name in $Names) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if (-not $value -and $DotEnvValues.ContainsKey($name)) {
      $value = $DotEnvValues[$name]
    }
    if ($value) {
      return $value
    }
  }

  if ($Required) {
    throw "Missing required value: $($Names -join ' or '). Add it to .env.local, .env, or set it in this shell before deploying."
  }

  return ""
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

$dotEnv = Merge-DotEnv @(".env", ".env.local")
$geminiApiKey = Get-DeployValue "GEMINI_API_KEY" $dotEnv -Required
$civicApiKey = Get-DeployValueFromAliases @("GOOGLE_CIVIC_API_KEY", "VITE_GOOGLE_CIVIC_API_KEY") $dotEnv
$speechApiKey = Get-DeployValue "SPEECH_TO_TEXT_API" $dotEnv
$googleCredentialsJson = Get-DeployValue "GOOGLE_APPLICATION_CREDENTIALS_JSON" $dotEnv
$firebaseServiceAccountJson = Get-DeployValue "FIREBASE_SERVICE_ACCOUNT_JSON" $dotEnv
$geocodingApiKey = Get-DeployValue "GOOGLE_GEOCODING_API_KEY" $dotEnv
$mapsApiKey = Get-DeployValue "GOOGLE_MAPS_API_KEY" $dotEnv
$firebaseWebApiKey = Get-DeployValueFromAliases @("FIREBASE_WEB_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY") $dotEnv -Required
$firebaseAuthDomain = Get-DeployValueFromAliases @("FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") $dotEnv -Required
$firebaseProjectId = Get-DeployValueFromAliases @("FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID") $dotEnv -Required
$firebaseAppId = Get-DeployValueFromAliases @("FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID") $dotEnv -Required
$firebaseMessagingSenderId = Get-DeployValueFromAliases @("FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID") $dotEnv
$firebaseStorageBucket = Get-DeployValueFromAliases @("FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") $dotEnv
$firebaseMeasurementId = Get-DeployValueFromAliases @("FIREBASE_MEASUREMENT_ID", "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID") $dotEnv
$geminiModel = Get-DeployValue "GEMINI_MODEL" $dotEnv
if (-not $geminiModel) {
  $geminiModel = "gemini-2.5-flash"
}

if (-not $civicApiKey) {
  Write-Warning "No GOOGLE_CIVIC_API_KEY was found. India mode can deploy, but the U.S. Google Civic provider will be unavailable."
}

if (-not $geocodingApiKey -and -not $mapsApiKey) {
  Write-Warning "No GOOGLE_GEOCODING_API_KEY or GOOGLE_MAPS_API_KEY was found. India mode will accept complete PIN-code addresses, but Google address normalization will be unavailable."
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
    identitytoolkit.googleapis.com `
    speech.googleapis.com `
    --project $ProjectId | Out-Null

  if ($civicApiKey) {
    & gcloud services enable civicinfo.googleapis.com --project $ProjectId | Out-Null
  }

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

$runtimeEnvVars = [ordered]@{
  FIRESTORE_DATABASE_ID = $FirestoreDatabaseId
  GEMINI_MODEL = $geminiModel
  NEXT_TELEMETRY_DISABLED = "1"
  FIREBASE_WEB_API_KEY = $firebaseWebApiKey
  FIREBASE_AUTH_DOMAIN = $firebaseAuthDomain
  FIREBASE_PROJECT_ID = $firebaseProjectId
  FIREBASE_APP_ID = $firebaseAppId
}

if ($firebaseMessagingSenderId) {
  $runtimeEnvVars["FIREBASE_MESSAGING_SENDER_ID"] = $firebaseMessagingSenderId
}
if ($firebaseStorageBucket) {
  $runtimeEnvVars["FIREBASE_STORAGE_BUCKET"] = $firebaseStorageBucket
}
if ($firebaseMeasurementId) {
  $runtimeEnvVars["FIREBASE_MEASUREMENT_ID"] = $firebaseMeasurementId
}

$envVars = ($runtimeEnvVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ","
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
$serviceDomain = ([Uri]$serviceUrl).Host
Write-Host "Next step: add this domain to Firebase Authentication authorized domains if Google or Guest sign-in is blocked:" -ForegroundColor Yellow
Write-Host $serviceDomain
