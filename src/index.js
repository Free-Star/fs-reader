const port = process.env.PORT || 3000;  // 使用环境变量或默认3000端口
app.listen(port, '0.0.0.0', () => {     // 监听所有网络接口
    console.log(`Server is running on port ${port}`);
}); 