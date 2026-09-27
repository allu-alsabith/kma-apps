import JSZip from 'jszip';
import { AppInstallTarget } from '../components/InstallModal';

export interface AppMetadata {
  id: string;
  name: string;
  packageName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  iconSlug: string;
}

export const APP_CONFIGS: Record<AppInstallTarget, AppMetadata> = {
  STAFF: {
    id: 'staff',
    name: 'Staff Mobile Attendance',
    packageName: 'com.workforce.staff',
    description: 'Staff mobile attendance app with GPS geofencing & biometric face punch',
    themeColor: '#0284c7',
    backgroundColor: '#05070d',
    iconSlug: 'staff',
  },
  KIOSK: {
    id: 'kiosk',
    name: 'Face Entrance Kiosk',
    packageName: 'com.workforce.kiosk',
    description: 'Entrance turnstile and tablet terminal with live biometric face scan',
    themeColor: '#059669',
    backgroundColor: '#05070d',
    iconSlug: 'kiosk',
  },
  ADMIN: {
    id: 'admin',
    name: 'Store Admin HR Console',
    packageName: 'com.workforce.admin',
    description: 'Store HR management console, employee roster, live audit & payroll',
    themeColor: '#7c3aed',
    backgroundColor: '#05070d',
    iconSlug: 'admin',
  },
  MANAGER: {
    id: 'manager',
    name: 'Apps Manager Hub',
    packageName: 'com.workforce.manager',
    description: 'Executive company management and multi-app provisioning hub',
    themeColor: '#d97706',
    backgroundColor: '#05070d',
    iconSlug: 'manager',
  },
};

/**
 * Generates and downloads a complete Android Studio APK project starter (.zip)
 * configured with Kotlin, full camera/biometric permissions, hardware acceleration, and WebView.
 */
export async function downloadAndroidProjectBundle(target: AppInstallTarget, appUrl: string): Promise<void> {
  const meta = APP_CONFIGS[target];
  const zip = new JSZip();

  const isKiosk = target === 'KIOSK';

  // 1. AndroidManifest.xml
  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${meta.packageName}">

    <!-- Hardware & Camera Permissions for Biometric Face ID -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.VIBRATE" />
    ${isKiosk ? '<uses-permission android:name="android.permission.WAKE_LOCK" />' : ''}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${meta.name}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.FullScreen"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|screenSize|screenLayout"
            android:screenOrientation="${isKiosk ? 'sensorLandscape' : 'portrait'}"
            android:theme="@style/Theme.FullScreen">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  // 2. MainActivity.kt
  const mainActivityKt = `package ${meta.packageName}

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val TARGET_URL = "${appUrl}"
    private val CAMERA_PERMISSION_CODE = 101

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Fullscreen Mode
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
        ${isKiosk ? 'window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)' : ''}

        webView = WebView(this)
        setContentView(webView)

        // Request Permissions
        checkAndRequestPermissions()

        // Configure WebView for Biometrics & PWA
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.webChromeClient = object : WebChromeClient() {
            // Automatically grant camera and microphone permission for Biometric FaceID
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
        }

        webView.loadUrl(TARGET_URL)
    }

    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), CAMERA_PERMISSION_CODE)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}`;

  // 3. build.gradle.kts (App Level)
  const buildGradleApp = `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "${meta.packageName}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${meta.packageName}"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.10.0")
}`;

  // 4. styles.xml for theme
  const stylesXml = `<resources>
    <style name="Theme.FullScreen" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowContentOverlay">@null</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
    </style>
</resources>`;

  // 5. Capacitor & Bubblewrap configurations
  const capacitorConfig = {
    appId: meta.packageName,
    appName: meta.name,
    webDir: 'dist',
    server: {
      url: appUrl,
      cleartext: true,
    },
    android: {
      allowMixedContent: true,
      captureInput: true,
      webContentsDebuggingEnabled: true,
    },
  };

  const twaManifest = {
    packageId: meta.packageName,
    host: new URL(appUrl).host,
    name: meta.name,
    launcherName: meta.name.slice(0, 12),
    themeColor: meta.themeColor,
    navigationColor: meta.backgroundColor,
    backgroundColor: meta.backgroundColor,
    startUrl: appUrl,
    iconUrl: `${new URL(appUrl).origin}/icons/icon.svg`,
    maskableIconUrl: `${new URL(appUrl).origin}/icons/icon.svg`,
    appVersionName: '1.0.0',
    appVersionCode: 1,
    shortcuts: [],
    generatorApp: 'google-ai-studio',
    webManifestUrl: `${new URL(appUrl).origin}/manifest-${meta.id}.json`,
  };

  // 6. Detailed README with 3 Options to Generate APK
  const readmeMd = `# ${meta.name} — Android APK Package

This package allows you to compile or download a standalone **Android APK** for **${meta.name}**, exactly like Android apps built in Google AI Studio.

---

### Option 1: Instant 1-Click APK Download (Cloud Builder)
1. Open [PWABuilder Android APK Generator](https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(appUrl)})
2. Click **"Package for Stores"** -> **"Android"**.
3. Download the compiled **.apk** file directly to your phone or computer.

---

### Option 2: Build in Android Studio
1. Open Android Studio.
2. Select **"Open an Existing Project"** and select this extracted folder.
3. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
4. Android Studio will generate the debug/release **${meta.packageName}.apk** in \`app/build/outputs/apk/release/\`.

---

### Option 3: Command Line (Capacitor or Bubblewrap)
\`\`\`bash
# Using Google's Bubblewrap TWA CLI:
npx @bubblewrap/cli build --manifest="${twaManifest.webManifestUrl}"

# Or using Capacitor:
npm install -g @capacitor/cli @capacitor/android
npx cap add android
npx cap open android
\`\`\`

Target Live URL: ${appUrl}
Package ID: ${meta.packageName}
Permissions: CAMERA, ACCESS_FINE_LOCATION, INTERNET
`;

  // Build the ZIP tree
  zip.file('README.md', readmeMd);
  zip.file('capacitor.config.json', JSON.stringify(capacitorConfig, null, 2));
  zip.file('twa-manifest.json', JSON.stringify(twaManifest, null, 2));
  zip.file('app/src/main/AndroidManifest.xml', manifestXml);
  zip.file(`app/src/main/java/com/kmasupermarket/${meta.id}/MainActivity.kt`, mainActivityKt);
  zip.file('app/src/main/res/values/styles.xml', stylesXml);
  zip.file('app/build.gradle.kts', buildGradleApp);

  // Generate & trigger browser download
  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${meta.name.replace(/\s+/g, '_')}_Android_APK_Project.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Generates an Apple iOS WebClip Configuration Profile (.mobileconfig).
 * When downloaded on an iPhone or iPad, iOS prompts: "Profile Downloaded - Review in Settings".
 * The user taps "Install" in Settings -> General -> VPN & Device Management,
 * and the app installs directly onto their iOS Home Screen with its own custom icon and full screen!
 */
export function downloadIosWebClipProfile(target: AppInstallTarget, appUrl: string): void {
  const meta = APP_CONFIGS[target];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://attendo.local';
  const iconUrl = `${origin}/icons/icon.svg`;

  const uuid1 = '9F4B' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-44B2-4322-92AE-77568940C1A1';
  const uuid2 = '8C3A' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-11C3-4411-82BB-66442299C2B2';

  const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            <key>Icon</key>
            <data></data>
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>${meta.name}</string>
            <key>PayloadDescription</key>
            <string>Installs ${meta.name} as a standalone app on iOS Home Screen</string>
            <key>PayloadDisplayName</key>
            <string>${meta.name}</string>
            <key>PayloadIdentifier</key>
            <string>${meta.packageName}.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>${uuid1}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>${appUrl}</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Deployment profile for ${meta.name}</string>
    <key>PayloadDisplayName</key>
    <string>${meta.name} Installer</string>
    <key>PayloadIdentifier</key>
    <string>${meta.packageName}.profile</string>
    <key>PayloadOrganization</key>
    <string>Workforce Systems</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${uuid2}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

  const blob = new Blob([mobileConfigXml], { type: 'application/x-apple-aspen-config' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${meta.name.replace(/\s+/g, '_')}_iOS_App.mobileconfig`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Cloud APK Builder URL (PWABuilder official package generator)
 */
export function getCloudApkBuilderUrl(appUrl: string): string {
  return `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(appUrl)}`;
}
