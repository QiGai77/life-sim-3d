# 素材来源与许可（Credits）

所有运行时资源都打包在 `public/` 里随站点自托管，**运行时不访问任何 CDN**（方便中国大陆访问）。

## 3D 角色 / 动物（CC0 1.0）

| 文件 | 原始素材 | 作者 | 许可 | 获取地址 |
|---|---|---|---|---|
| `public/models/mom.glb` | Ultimate Modular Women – *Casual* | Quaternius | CC0 1.0 | https://quaternius.com （镜像：https://github.com/Papyszoo/CC0-Public-Domain-Models/tree/main/packs/quaternius-ultimatemodularwomen） |
| `public/models/dad.glb` | Ultimate Modular Men – *Casual 2* | Quaternius | CC0 1.0 | https://quaternius.com （镜像：.../packs/quaternius-ultimatemodularcharacters） |
| `public/models/shiba.glb` | Ultimate Animated Animals – *Shiba Inu* | Quaternius | CC0 1.0 | https://quaternius.com （镜像：.../packs/quaternius-ultimateanimatedanimals） |

处理：用 glTF-Transform 只保留用到的动画片段、重采样、去重，并做 `EXT_meshopt_compression` + `KHR_mesh_quantization` 压缩（运行时用 three.js 自带的 MeshoptDecoder 解码）。运行时重算平滑法线、换成 PBR 材质并重新配色。

## PBR 贴图（Poly Haven，CC0 1.0）

https://polyhaven.com/license — 全部 CC0。均下载 1k JPG 后缩放/重新压缩。

| 文件 | Poly Haven 素材 |
|---|---|
| `tex/floor_diff.jpg`, `tex/floor_nor.jpg`, `tex/floor_rough.jpg` | [laminate_floor_02](https://polyhaven.com/a/laminate_floor_02) |
| `tex/wall_nor.jpg` | [plastered_wall_04](https://polyhaven.com/a/plastered_wall_04) |
| `tex/rug_nor.jpg` | [terry_cloth](https://polyhaven.com/a/terry_cloth) |
| `tex/velvet_nor.jpg` | [velour_velvet](https://polyhaven.com/a/velour_velvet) |
| `tex/teddy_nor.jpg`, `tex/fur_detail.jpg` | [curly_teddy_natural](https://polyhaven.com/a/curly_teddy_natural) |
| `tex/wood_grain.jpg`, `tex/oak_nor.jpg` | [oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) |
| `tex/knit_nor.jpg` | [knitted_fleece](https://polyhaven.com/a/knitted_fleece) |

## 环境光 HDRI（Poly Haven，CC0 1.0）

| 文件 | 素材 |
|---|---|
| `env/lebombo_512.hdr` | [lebombo](https://polyhaven.com/a/lebombo)（1k 版本降采样到 512×256，RGBE） |

加载失败时自动回退到 three.js 的 `RoomEnvironment`（程序生成，无外部文件）。

## 字体（SIL OFL 1.1）

| 文件 | 字体 | 许可 |
|---|---|---|
| `public/fonts/wenkai-sub.woff2` | [霞鹜文楷 LXGW WenKai](https://github.com/lxgw/LxgwWenKai) Medium v1.530，按游戏内用到的字裁剪子集（`scripts/subset-font.py`） | SIL Open Font License 1.1 |

## 其余

- 界面图标（奶瓶、月亮、爱心、星星、小手、嘴巴、哭脸、笑脸、清单、印章等）均为本项目手绘风格内联 SVG，原创。
- 纸张纹理、墙纸图案、地毯图案、积木字母等由代码（Canvas）程序生成。
- 所有音效 / 摇篮曲由 WebAudio 实时合成，无音频文件。
