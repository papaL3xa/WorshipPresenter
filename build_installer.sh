#!/bin/bash
# Script Otomatis: Membuat File Installer (.exe Setup) + Upload ke GitHub Releases
# ---------------------------------------------------------

cd "$(dirname "$0")"

echo "==================================================="
echo "1. MENYIMPAN PERUBAHAN KE GITHUB"
echo "==================================================="

git status -s
git add .

COMMIT_MSG="Build Installer: $(date +'%Y-%m-%d %H:%M:%S')"
if [ -n "$1" ]; then
    COMMIT_MSG="$1"
fi

git commit -m "$COMMIT_MSG" || echo "Tidak ada perubahan baru untuk di-commit."
git push origin HEAD

echo ""
echo "==================================================="
echo "2. MEMBUAT FILE INSTALLER (.exe Setup)"
echo "==================================================="

cd frontend || { echo "Gagal menemukan folder frontend!"; exit 1; }

echo "Sedang mengompilasi kode..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build kode GAGAL! Cek error di atas."
    exit 1
fi

echo "Sedang mengemas menjadi file Installer (.exe)..."
npx electron-builder --win --x64

if [ $? -eq 0 ]; then
    echo "Membersihkan file-file sementara..."
    mkdir -p release
    rm -f release/*.exe
    mv release-installer/*.exe release/ 2>/dev/null
    rm -rf release-installer

    echo "==================================================="
    echo "✅ INSTALLER BERHASIL DIBUAT!"
    echo "Hanya File Installer yang disimpan di:"
    echo "$(pwd)/release/"
    echo ""
    echo "Cari file bernama: 'Worship Presenter Setup *.exe'"
    echo "==================================================="

    # ===================================================
    # 3. UPLOAD KE GITHUB RELEASES (via curl / GitHub API)
    # ===================================================
    echo ""
    echo "==================================================="
    echo "3. MENGUPLOAD KE GITHUB RELEASES"
    echo "==================================================="

    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.3")
    TAG="v${VERSION}"
    EXE_FILE=$(ls release/Worship\ Presenter\ Setup\ ${VERSION}.exe 2>/dev/null || ls release/Worship\ Presenter\ Setup\ *.exe 2>/dev/null | head -n 1)

    # Ambil token dari git remote URL
    REPO_URL=$(git -C .. remote get-url origin)
    GH_TOKEN=$(echo "$REPO_URL" | sed -n 's|.*:\(ghp_[^@]*\)@.*|\1|p')
    REPO="papaL3xa/WorshipPresenter"

    if [ -z "$EXE_FILE" ]; then
        echo "⚠️  File .exe tidak ditemukan, skip upload."
    elif [ -z "$GH_TOKEN" ]; then
        echo "⚠️  Token GitHub tidak ditemukan, skip upload."
    else
        echo "📦 Versi : $TAG"
        echo "📁 File  : $EXE_FILE"
        echo "🔗 Repo  : $REPO"

        # Hapus release lama dengan tag yang sama jika ada
        RELEASE_ID=$(curl -s -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/$REPO/releases/tags/$TAG" | \
            grep '"id"' | head -n1 | sed 's/[^0-9]//g')

        if [ -n "$RELEASE_ID" ]; then
            echo "🗑️  Menghapus release lama (ID: $RELEASE_ID)..."
            curl -s -X DELETE -H "Authorization: token $GH_TOKEN" \
                "https://api.github.com/repos/$REPO/releases/$RELEASE_ID"
        fi

        # Hapus git tag lama jika ada
        curl -s -X DELETE -H "Authorization: token $GH_TOKEN" \
            "https://api.github.com/repos/$REPO/git/refs/tags/$TAG" > /dev/null

        # Buat release baru
        echo "📤 Membuat release baru '$TAG'..."
        RELEASE_RESPONSE=$(curl -s -X POST \
            -H "Authorization: token $GH_TOKEN" \
            -H "Content-Type: application/json" \
            "https://api.github.com/repos/$REPO/releases" \
            -d "{
                \"tag_name\": \"$TAG\",
                \"target_commitish\": \"desktop-app\",
                \"name\": \"Worship Presenter $TAG\",
                \"body\": \"### 🎉 Worship Presenter $TAG\n\n**Download dan install file .exe di bawah ini.**\n\nVersi ini sudah include semua perubahan terbaru.\n- Build otomatis dari branch \`desktop-app\`\n- Tanggal: $(date +'%d %B %Y')\",
                \"draft\": false,
                \"prerelease\": false,
                \"make_latest\": \"true\"
            }")

        NEW_RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep '"id"' | head -n1 | sed 's/[^0-9]//g')
        UPLOAD_URL="https://uploads.github.com/repos/$REPO/releases/$NEW_RELEASE_ID/assets"

        if [ -z "$NEW_RELEASE_ID" ]; then
            echo "❌ Gagal membuat release. Response: $RELEASE_RESPONSE"
        else
            echo "✅ Release dibuat (ID: $NEW_RELEASE_ID)"
            echo "⬆️  Mengupload file .exe... (ini mungkin butuh beberapa menit)"

            EXE_NAME=$(basename "$EXE_FILE")
            UPLOAD_RESPONSE=$(curl -s -X POST \
                -H "Authorization: token $GH_TOKEN" \
                -H "Content-Type: application/octet-stream" \
                --data-binary @"$EXE_FILE" \
                "$UPLOAD_URL?name=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$EXE_NAME'))" 2>/dev/null || echo "$EXE_NAME")")

            DOWNLOAD_URL=$(echo "$UPLOAD_RESPONSE" | grep '"browser_download_url"' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/')

            if [ -n "$DOWNLOAD_URL" ]; then
                echo "==================================================="
                echo "✅ BERHASIL DIUPLOAD KE GITHUB RELEASES!"
                echo "   https://github.com/$REPO/releases/tag/$TAG"
                echo "   Download: $DOWNLOAD_URL"
                echo "==================================================="
            else
                echo "❌ Gagal upload file. Response: $UPLOAD_RESPONSE"
            fi
        fi
    fi
else
    echo "==================================================="
    echo "❌ PROSES BUILD INSTALLER GAGAL!"
    echo "Terjadi kesalahan. Cek error di atas."
    echo "==================================================="
fi
