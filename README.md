# 好好吃饭 · 手机网页

公开网站： https://xy99456852-max.github.io/haochi-mobile/

支持菜品、饭店、菜系筛选，随机抽选，预算/辣度筛选，收藏与最近抽选记录；手机单列界面和底部导航。

## 编辑共享菜单

访客无需登录即可浏览。管理员点“管理菜单”，使用仅授权本仓库的 GitHub Fine-grained personal access token，仓库权限为 Contents: Read and write。凭证只留在页面内存，刷新即清除；请勿将凭证写入源码、Issue 或聊天。

菜单和照片公开可见。照片选取后压缩为最大边 1400px 的 JPG，点击保存后与菜单一起提交。菜单存放在 data/menu.json 和 docs/data/menu.json；照片在 public/photos 和 docs/photos。GitHub Actions 将 main 分支的 docs/ 发布至 Pages。保存后其他设备需等待 Pages 完成发布，再刷新网页。上传和编辑需要手机能访问 api.github.com。

修改同一条记录时检测冲突；不同记录的同时修改合并到最新版本。提交仅快进更新 main，不强制覆盖。删除可在 Git 提交历史中恢复。收藏和随机历史只存当前浏览器。

## 开发

Node.js 24+：`npm ci`、`npm test`、`npm run build`。发布目录为 docs/，提交源码与构建产物即可。构建保留已有菜单，不会用示例覆盖自定义记录。

示例餐厅、菜品用于展示，请替换为你们熟悉的店。示例照片来自 Unsplash。
