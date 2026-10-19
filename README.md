# Arakawa Flood Desktop — 荒川第一調節池・荒川流域 3Dシミュレーター

荒川第一調節池（彩湖・秋ヶ瀬公園）および堤防群（越流堤・囲ぎょう堤・本堤）の治水メカニズムを、国土地理院 5m DEM (DEM5A) と Three.js で高精度に可視化・シミュレーションするデスクトップアプリケーション（Tauri v2）です。

---

## 1. アプリ概要

* **越流堤・堤防群の精緻な3Dモデル化**:
  * 越流堤（A.P. +8.70m）
  * 囲ぎょう堤（約 A.P. +15.1m）
  * 荒川本堤（約 A.P. +15.2m）
  * 国土地理院 5m メッシュ標高 (DEM5A) によるリアルな地形・彩湖湖底
* **リアルタイム水理計算**:
  * 広頂越流堰公式 ($Q = C \cdot B \cdot H^{1.5}$) による越流流入量 $Q$ (m³/s)
  * H-V貯水容量曲線に基づく調節池水位の上昇と下流水位低減効果
* **ダイナミック横断断面図**:
  * 朝霞市街地 〜 本川 〜 越流堤 〜 囲ぎょう堤 〜 調節池 〜 本堤 〜 戸田市街地 を貫くリアルタイム断面
* **シナリオ検証 & CSV出力**:
  * 令和元年 台風19号（実測ハイドログラフによる3,500万m³貯留再現）
  * 計画規模 (L1) / 想定最大規模 (L2) 洪水
  * 30秒刻み計算データの10分間隔CSV出力（UTF-8 BOM付き、Excel対応）
* **広域流域パノラマ**:
  * 秩父山地から東京湾まで 168km 四方の広域背景地形

---

## 2. 開発・実行手順

### 必要な環境
* **Node.js**: v18 以上 (推奨 v22)
* **Rust**: 1.77.2 以上 (推奨 stable)

```bash
cd arakawa_flood_desktop
npm install
```

### 開発モード（ホットリロード）
```bash
npm run dev:app
```

### macOS アプリ / DMG のローカルビルド
```bash
npm run build:app
```
* ビルド生成先:
  * `.dmg`: `src-tauri/target/release/bundle/dmg/ArakawaFlood_1.0.0_aarch64.dmg`
  * `.app`: `src-tauri/target/release/bundle/macos/ArakawaFlood.app`

---

## 3. Windows 版 (EXE) の GitHub Actions ビルド & リリース

Windows版（NSISインストーラー `.exe`）は、GitHub Actions を通じてクラウド環境（`windows-latest`）で自動ビルドされます。

### 自動ビルド手順:
1. **GitHub にリポジトリをプッシュ**:
   ```bash
   git init
   git add .
   git commit -m "feat: Arakawa Flood Desktop initial release"
   git remote add origin https://github.com/<owner>/arakawa_flood_desktop.git
   git push -u origin main
   ```

2. **タグをプッシュして自動リリース**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   * `.github/workflows/build-windows.yml` が自動起動。
   * Windows x64 環境でビルドされ、NSIS インストーラー `.exe` が GitHub Releases に自動添付されます。

3. **手動実行 (workflow_dispatch)**:
   * GitHub リポジトリの **Actions** タブ → **Build and Release Desktop App (Windows)** → **Run workflow** からも手動でビルド可能です。
