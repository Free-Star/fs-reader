# Fs Reader(EPUB阅读器)

一个使用 Vue 3 + TypeScript 构建的网页版电子书阅读器应用。

## 功能特点

- 📚 支持电子书库管理
- 📖 在线阅读电子书
- 🔖 阅读进度保存
- 🌙 支持深色/浅色主题切换
- 📝 支持标注和笔记功能
- 🔗 外链z-library,解决书籍资源问题

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- SCSS

## 部署

### Git 部署

1. 克隆项目
```bash
git clone https://github.com/your-username/fs-reader.git
cd fs-reader
```

2. 安装依赖
```bash
npm install
```

3. 构建生产环境
```bash
npm run build
```

4. 启动项目
```bash
npm run preview
```

### Docker 部署

1. 构建 Docker 镜像
```bash
docker build -t fs-reader .
```

2. 运行容器
```bash
docker run -d -p 9000:5173 fs-reader
```

或者使用 docker-compose:

```bash
docker-compose up -d
```



## 许可证

本项目采用 MIT 许可证



## 作者

- 作者：freestar
- 邮箱：freestar666666@gmail.com