#!/bin/bash
# Upload file .exe yang sudah ada ke GitHub Releases

cd "$(dirname "$0")/frontend"

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.3")
TAG="v${VERSION}"
EXE_FILE=$(ls release/Worship\ Presenter\ Setup\ *.exe 2>/dev/null | head -n 1)

# Ambil token dari git remote URL
REPO_URL=$(git -C .. remote get-url origin)
GH_TOKEN=$(echo "$REPO_URL" | sed -n 's|.*:\(ghp_[^@]*\)@.*|\1|p')
REPO="papaL3xa/WorshipPresenter"

echo "📦 Versi  : $TAG"
echo "📁 File   : $EXE_FILE"
echo "🔗 Repo   : $REPO"
echo ""

if [ -z "$EXE_FILE" ]; then
    echo "❌ File .exe tidak ditemukan di: $(pwd)/release/"
    exit 1
fi

# Hapus release lama dengan tag yang sama jika ada
echo "Mengecek release lama..."
RELEASE_ID=$(curl -s -H "Authorization: token $GH_TOKEN" \
    "https://api.github.com/repos/$REPO/releases/tags/$TAG" | \
    grep '"id"' | head -n1 | sed 's/[^0-9]//g')

if [ -n "$RELEASE_ID" ]; then
    echo "🗑️  Menghapus release lama (ID: $RELEASE_ID)..."
    curl -s -X DELETE -H "Authorization: token $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/releases/$RELEASE_ID"
fi

# Hapus git tag lama jika ada
echo "Membersihkan tag lama..."
curl -s -X DELETE -H "Authorization: token $GH_TOKEN" \
    "https://api.github.com/repos/$REPO/git/refs/tags/$TAG" > /dev/null

# Buat release baru
echo "📤 Membuat GitHub Release '$TAG'..."
RELEASE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GH_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/$REPO/releases" \
    -d "{
        \"tag_name\": \"$TAG\",
        \"target_commitish\": \"desktop-app\",
        \"name\": \"Worship Presenter $TAG\",
        \"body\": \"### Worship Presenter $TAG\n\nDownload dan install file .exe di bawah ini.\n\nVersi terbaru dengan semua fitur dan perbaikan.\",
        \"draft\": false,
        \"prerelease\": false,
        \"make_latest\": \"true\"
    }")

NEW_RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep '"id"' | head -n1 | sed 's/[^0-9]//g')

if [ -z "$NEW_RELEASE_ID" ]; then
    echo "❌ Gagal membuat release."
    echo "$RELEASE_RESPONSE"
    exit 1
fi

echo "✅ Release dibuat (ID: $NEW_RELEASE_ID)"
echo ""
echo "⬆️  Mengupload file .exe... (butuh beberapa menit untuk file ~120MB)"

EXE_NAME=$(basename "$EXE_FILE")
EXE_NAME_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$EXE_NAME'))" 2>/dev/null || echo "${EXE_NAME// /%20}")

UPLOAD_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GH_TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$EXE_FILE" \
    "https://uploads.github.com/repos/$REPO/releases/$NEW_RELEASE_ID/assets?name=$EXE_NAME_ENCODED")

DOWNLOAD_URL=$(echo "$UPLOAD_RESPONSE" | grep '"browser_download_url"' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

if [ -n "$DOWNLOAD_URL" ]; then
    echo ""
    echo "==================================================="
    echo "✅ BERHASIL DIUPLOAD KE GITHUB RELEASES!"
    echo "   Release : https://github.com/$REPO/releases/tag/$TAG"
    echo "   Download: $DOWNLOAD_URL"
    echo "==================================================="
else
    echo "❌ Gagal upload file."
    echo "$UPLOAD_RESPONSE"
fi
