#!/usr/bin/env bash
# Builds the app against the local Supabase stack and runs the Maestro flows on the
# iOS simulator. See .maestro/README.md.
set -euo pipefail

cd "$(dirname "$0")/.."

DEVICE="${E2E_DEVICE:-iPhone 17 Pro}"

# CocoaPods crashes on a non-UTF-8 locale.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# Homebrew's JDK is keg-only, so Maestro would find macOS's java stub instead.
if [ -d /opt/homebrew/opt/openjdk ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk
  export PATH="$JAVA_HOME/bin:$PATH"
fi

supabase start -x studio,imgproxy,vector,logflare,mailpit,edge-runtime
eval "$(supabase status -o env)"

# Release embeds the JS bundle, so the app needs no Metro server. EXPO_PUBLIC_* are baked
# in at bundle time; shell values win over .env, so the build can't pick up prod keys.
export APP_VARIANT=development
export EXPO_PUBLIC_SUPABASE_URL="$API_URL"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export EXPO_PUBLIC_TMDB_ACCESS_TOKEN=
export EXPO_PUBLIC_POSTHOG_KEY=

# ios/ is generated and git-ignored.
[ -d ios ] || npx expo prebuild --platform ios --no-install

# Recent Xcode rejects pod targets older than iOS 15, and a few pods still declare less.
python3 - <<'EOF'
path = "ios/Podfile"
src = open(path).read()
marker = "# Recent Xcode rejects pod targets older than iOS 15."
anchor = "      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n"
if marker not in src:
    assert anchor in src, "Podfile layout changed: update the patch in scripts/e2e-ios.sh"
    patch = (
        f"    {marker}\n"
        "    installer.pods_project.targets.each do |t|\n"
        "      t.build_configurations.each do |c|\n"
        "        c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1' if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.0\n"
        "      end\n"
        "    end\n"
    )
    open(path, "w").write(src.replace(anchor, anchor + patch))
EOF
(cd ios && pod install)

# `expo run:ios` insists on opening Simulator.app, which not every Xcode install ships,
# so drive the simulator headlessly instead.
xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcodebuild -workspace ios/WatchlineDev.xcworkspace -scheme WatchlineDev \
  -configuration Release -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath ios/build build -quiet
xcrun simctl install booted ios/build/Build/Products/Release-iphonesimulator/WatchlineDev.app

maestro test -e API_URL="$API_URL" -e ANON_KEY="$ANON_KEY" .maestro
