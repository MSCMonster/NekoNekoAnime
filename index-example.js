#!/usr/bin/env node
const path = require('path');
const util = require('util');
const ejs = require('ejs');
const renderFile = util.promisify(ejs.renderFile);
const axios = require('axios');
var qs = require('qs');
const cheerio = require('cheerio');
const exec = util.promisify(require('child_process').exec);  // exec 返回Promise对象
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// const https = require('https');
const session = require('express-session');
const sharedSession = require('express-socket.io-session');
const fs = require('fs');
const schedule = require('node-schedule');

// 服务器网页端口
const port = 3010;  // https port
const httpPort = 3000;

// Mikan的域名 如果使用反代服务器则改为反代服务器域名
const mikanHost = "https://mikanani.me";
// 代理服务器地址
// TODO: 不使用代理服务器
const proxyConfig = {
    host: 'localhost',
    port: 4780,  // [请自行修改]
};
// 动漫视频文件存放路径
const animePath = path.join('D:', 'anime');  // [请自行修改]
// 数据库设置
const dbConfig = {
    host: 'localhost',
    user: '',  // [请自行修改]
    password: '',  // [请自行修改]
    database: ''  // [请自行修改]
};

// qbittorrent 配置 账号密码无实际作用, 请在qbittorrent里允许本地用户绕过验证
const qbittorrentConfig = {
    host: 'http://localhost:8080',
    username: '',
    password: ''
};

// ffmpeg路径 如果添加了环境变量直接使用ffmpeg就可以 否则输入完整路径 路径里有空格请加上引号
const ffmpegPath = `ffmpeg`;
// ffmpeg视频编码设置 [请自行选择]
const ffmpegEncoding = "libx264"; // 速度较低
// const ffmpegEncoding = "h264_amf";  // 备用 AMD 加速
// const ffmpegEncoding = "h264_nvenc"; // 备用 NVIDIA 加速
const ffmpegExtra = "-tune animation -crf 20"; // 额外参数

// 读取 SSL 证书和私钥文件
const SSLOptions = {
    key: fs.readFileSync('./nekoneko.site.key'),  // [请自行修改]
    cert: fs.readFileSync('./nekoneko.site.crt')  // [请自行修改]
};

const defaultUserPerm = 9999;  // 用户默认权限

// 获取格式化时间字符串
function getFormattedTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// 格式化时间
function formatDate(maxDate) {
    const formattedDate = `${maxDate.getFullYear()}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${String(maxDate.getDate()).padStart(2, '0')} ${String(maxDate.getHours()).padStart(2, '0')}:${String(maxDate.getMinutes()).padStart(2, '0')}:${String(maxDate.getSeconds()).padStart(2, '0')}`;
    return formattedDate;
}

// 格式化时间
function formatDay(maxDate) {
    const formattedDate = `${maxDate.getFullYear()}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${String(maxDate.getDate()).padStart(2, '0')}`;
    return formattedDate;
}

// 文件大小字符串转为字节数
function parseFileSize(fileSizeStr) {
    const units = {
        B: 1,
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
        TB: 1024 * 1024 * 1024 * 1024,
    };
    const sizeRegex = /^(\d+(\.\d+)?)\s*([BKMGT]?B)$/i;
    const match = fileSizeStr.match(sizeRegex);
    if (match && match.length === 4) {
        const value = parseFloat(match[1]);
        const unit = match[3].toUpperCase();
        if (units.hasOwnProperty(unit)) {
            return Math.floor(value * units[unit]);
        }
    }
    return NaN; // 表示解析失败
}

// 字节数转文本
function formatFileSize(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 检查是不是只有数字
function isdig(str) {
    const digitsPattern = /^\d+$/;
    return digitsPattern.test(str);
}

// 判断文件或者目录
function checkPathType(path) {
    try {
        const stats = fs.statSync(path);
        if (stats.isFile()) {
            // 是文件路径
            return 1;
        } else if (stats.isDirectory()) {
            // 是目录路径
            return 0;
        } else {
            // 其他情况
            return -1;
        }
    } catch (err) {
        // 发生错误，路径不存在或其他异常
        return -1;
    }
}

// 替换路径
function isPathInsideDirectory(filePath, directoryPath, replacement) {
    const normalizedFilePath = path.normalize(filePath);
    const normalizedDirectoryPath = path.normalize(directoryPath);

    if (!normalizedFilePath.startsWith(normalizedDirectoryPath + path.sep)) {
        return false;
    }

    const relativePath = normalizedFilePath.slice(normalizedDirectoryPath.length + 1);
    const result = path.join(replacement, relativePath);

    return result;
}

// 列表随机选择
function randomChoice(arr) {
    const randomIndex = Math.round(Math.random() * (arr.length - 1));
    return arr[randomIndex];
}

// 随机选多个
function randomSample(elements, count) {
    var randomElements = [];
    // 确保要选取的数量不超过列表长度
    count = Math.min(count, elements.length);

    // 使用while循环随机选取元素
    while (randomElements.length < count) {
        var randomIndex = Math.floor(Math.random() * elements.length);
        // 确保不重复选取元素
        if (randomElements.indexOf(elements[randomIndex]) === -1) {
            randomElements.push(elements[randomIndex]);
        }
    }

    return randomElements;
}

// 提取字符串列表的正则表达式
function generateRegex(stringList) {
    if (stringList.length === 1) {
        return new RegExp(`^(.*?)$`);
    }

    let commonPrefix = stringList[0];
    let commonSuffix = stringList[0];

    for (const str of stringList) {
        let i = 0;
        while (i < commonPrefix.length && commonPrefix[i] === str[i]) {
            i++;
        }
        commonPrefix = commonPrefix.slice(0, i);

        i = 0;
        while (i < commonSuffix.length && commonSuffix[commonSuffix.length - 1 - i] === str[str.length - 1 - i]) {
            i++;
        }
        commonSuffix = commonSuffix.slice(-i);
    }

    const regexPattern = `^${commonPrefix}(.*?)${commonSuffix}$`;
    return new RegExp(regexPattern);
}


// 加载public目录下的静态文件
// app.get('/public/style.css', (req, res) => { res.sendFile(__dirname + '/public/style.css'); });
// app.get('/public/header.css', (req, res) => { res.sendFile(__dirname + '/public/header.css'); });
// app.get('/public/index.css', (req, res) => { res.sendFile(__dirname + '/public/index.css'); });
// app.get('/public/animeindex.css', (req, res) => { res.sendFile(__dirname + '/public/animeindex.css'); });
// app.get('/public/animeplayer.css', (req, res) => { res.sendFile(__dirname + '/public/animeplayer.css'); });
// app.get('/public/animeconsole.css', (req, res) => { res.sendFile(__dirname + '/public/animeconsole.css'); });
// app.get('/public/auth.css', (req, res) => { res.sendFile(__dirname + '/public/auth.css'); });
// app.get('/public/animeindex.js', (req, res) => { res.sendFile(__dirname + '/public/animeindex.js'); });
// app.get('/public/animeplayer.js', (req, res) => { res.sendFile(__dirname + '/public/animeplayer.js'); });
// app.get('/public/animeplayer-v2.js', (req, res) => { res.sendFile(__dirname + '/public/animeplayer-v2.js'); });
// app.get('/public/animeconsole.js', (req, res) => { res.sendFile(__dirname + '/public/animeconsole.js'); });
// app.get('/public/main.js', (req, res) => { res.sendFile(__dirname + '/public/main.js'); });
// app.get('/public/imgascii.js', (req, res) => { res.sendFile(__dirname + '/public/imgascii.js'); });
// app.get('/public/randomw.js', (req, res) => { res.sendFile(__dirname + '/public/randomw.js'); });
// app.get('/public/randomw.css', (req, res) => { res.sendFile(__dirname + '/public/randomw.css'); });
// app.get('/public/jquery-3.6.0.min.js', (req, res) => { res.sendFile(__dirname + '/public/jquery-3.6.0.min.js'); });
// app.get('/public/plyr_3.7.8.js', (req, res) => { res.sendFile(__dirname + '/public/plyr_3.7.8.js'); });
// app.get('/public/plyr_3.7.8.css', (req, res) => { res.sendFile(__dirname + '/public/plyr_3.7.8.css'); });
// app.get('/public/placeholder.min.mp4', (req, res) => { res.sendFile(__dirname + '/public/placeholder.min.mp4'); });
// app.get('/public/placeholder.min.jpg', (req, res) => { res.sendFile(__dirname + '/public/placeholder.min.jpg'); });
// app.get('/public/mdui.min.css', (req, res) => { res.sendFile(__dirname + '/public/mdui.min.css'); });
// app.get('/public/mdui.min.js', (req, res) => { res.sendFile(__dirname + '/public/mdui.min.js'); });
// app.get('/public/class_schedule.css', (req, res) => { res.sendFile(__dirname + '/public/class_schedule.css'); });
// app.get('/public/index.74ecf734.js', (req, res) => { res.sendFile(__dirname + '/public/index.74ecf734.js'); });

// let server = undefined;
// if (useSSL) {
//     const https = require('https');
//     server = https.createServer(SSLOptions, app);
// } else {
//     const http = require('http');
//     server = http.createServer(app);
// }

// 创建目录
const pathList = [
    '/animes',
    '/animes/cover',
    '/downloads',
  ];
  
  function createDirectoryRecursively(dirPath) {
    const normalizedPath = path.normalize(dirPath);
  
    if (!fs.existsSync(normalizedPath)) {
      // 如果路径不存在，创建它
      fs.mkdirSync(normalizedPath, { recursive: true });
      console.log(`已创建目录：${normalizedPath}`);
    } else {
      console.log(`目录已存在：${normalizedPath}`);
    }
  }
  
  // 递归的创建目录
  pathList.forEach((dirPath) => {
    createDirectoryRecursively(dirPath);
  });

const https = require('https');
const http = require('http');
const server = https.createServer(SSLOptions, app);
const httpServer = http.createServer(app);

//const server = http.createServer({}, app);
const io = require('socket.io')(server);
const mysql = require('mysql');
const tunnel = require('tunnel');
const httpProxy = tunnel.httpsOverHttp({
    proxy: proxyConfig
});

// 设置模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('ejs', require('ejs').__express);

// app.use((req, res, next) => {
//     if (req.protocol === 'http') {
//         const httpsUrl = `https://${req.headers.host}${req.originalUrl}`;
//         return res.redirect(httpsUrl);
//     }
//     next();
// });

// 设置中间件
app.use(express.urlencoded({ extended: false }));

// 创建会话
const expressSession = session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 180 * 24 * 60 * 60 * 1000 }
});
app.use(expressSession);

// 在Socket.IO中使用Express会话
// TODO: 好像不起作用
io.use(sharedSession(expressSession, {
    autoSave: true
}));

// 以系统的名义在聊天室发送消息
function sendSystemMessage(msg) {
    const message = `[${getFormattedTimestamp()}]${msg}`;
    const systemMessage = { nickname: '系统', message };

    // 将系统消息保存到数据库
    db.query('INSERT INTO messages (nickname, message) VALUES (?, ?)', ['系统', message], (err) => {
        if (err) {
            console.error(err);
        }
    });

    // 广播系统消息给所有连接的客户端
    io.emit('chatMessage', systemMessage);
}

// 创建数据库连接
const db = mysql.createConnection(dbConfig);

// 连接数据库
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log(`[${getFormattedTimestamp()}][系统]连接到数据库成功`);
});

// 每半小时执行一次查询 避免断开连接
setInterval(() => {
    db.query('SELECT * FROM messages ORDER BY id DESC LIMIT 1', (error, results) => {
        if (error) {
            console.error('自动查询出错:', error);
        } else {
            console.log(`[${getFormattedTimestamp()}][系统]自动查询完成`);
        }
    });
}, 30 * 60 * 1000); // 30 分钟

// 监听 "error" 事件，在连接断开时进行重新连接
// TODO: 不知道能不能生效
db.on('error', (err) => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log(`[${getFormattedTimestamp()}][系统]与数据库的连接已断开，正在尝试重新连接...`);
        handleReconnect();
    } else {
        throw err;
    }
});

// 重新连接逻辑
function handleReconnect() {
    // 延迟一段时间后尝试重新连接
    setTimeout(() => {
        db.connect((err) => {
            if (err) {
                handleReconnect();
            } else {
                console.log(`[${getFormattedTimestamp()}][系统]已重新连接到数据库`);
            }
        });
    }, 1000); // 1 秒后进行重新连接
}

// 创建数据表
if (1) {
    // 创建聊天记录表
    db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nickname VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建用户信息表
    db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      nickname VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL, 
      perm INT
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建字幕组
    db.query(`
    CREATE TABLE IF NOT EXISTS stg (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
      url VARCHAR(255) UNIQUE,
      stgid INT UNIQUE
    );
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建动漫表
    db.query(`
    CREATE TABLE IF NOT EXISTS animes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      animename VARCHAR(255) UNIQUE,
      coverurl VARCHAR(255),
      start_date DATE,
      last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      file_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      mkid VARCHAR(255) UNIQUE, 
      bgmid VARCHAR(255) UNIQUE, 
      stgid INT, 
      finished TINYINT DEFAULT '0',
      torrentreg VARCHAR(255) DEFAULT '', 
      filereg VARCHAR(255) DEFAULT '', 
      maxep INT,
      filecount INT, 
      bittorrentcount INT, 
      FOREIGN KEY (stgid) REFERENCES stg(id)
    );
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建字幕组 动漫关联表
    db.query(`
    CREATE TABLE IF NOT EXISTS animestg (
      id INT AUTO_INCREMENT PRIMARY KEY,
      anime_id INT,
      stg_id INT,
      files TEXT, 
      FOREIGN KEY (anime_id) REFERENCES animes(id),
      FOREIGN KEY (stg_id) REFERENCES stg(id), 
      UNIQUE KEY unique_ab (anime_id, stg_id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建动漫别称表
    db.query(`
    CREATE TABLE IF NOT EXISTS animealias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alias VARCHAR(255) NOT NULL,
      anime_id INT, 
      user_id INT, 
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES animes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建文件表
    db.query(`
    CREATE TABLE IF NOT EXISTS files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      path VARCHAR(255) UNIQUE,
      localpath VARCHAR(255) UNIQUE,
      anime_id INT,
      ep VARCHAR(255),
      ok TINYINT DEFAULT '0',
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (anime_id) REFERENCES animes(id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建播放记录表
    db.query(`
    CREATE TABLE IF NOT EXISTS playlogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      anime_id INT,
      file_id INT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (anime_id) REFERENCES animes(id),
      FOREIGN KEY (file_id) REFERENCES files(id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建播放记录表
    db.query(`
    CREATE TABLE IF NOT EXISTS animelogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      anime_id INT,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (anime_id) REFERENCES animes(id),
      UNIQUE KEY unique_userid_animeid (user_id, anime_id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建动漫评论表
    db.query(`
    CREATE TABLE IF NOT EXISTS animecomments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      comment TEXT NOT NULL,
      anime_id INT, 
      user_id INT, 
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_delete TINYINT,
      delete_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      FOREIGN KEY (anime_id) REFERENCES animes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });

    // 创建种子表
    db.query(`
      CREATE TABLE IF NOT EXISTS bittorrent (
        xt varchar(255) NOT NULL PRIMARY KEY,
        anime_id int(11) DEFAULT NULL,
        filename varchar(255) DEFAULT NULL,
        download_link varchar(255) DEFAULT NULL,
        update_date timestamp NOT NULL DEFAULT current_timestamp(),
        filesize bigint(20) DEFAULT NULL,
        state tinyint(4) DEFAULT NULL,
        progress float DEFAULT NULL,
        path varchar(255) DEFAULT NULL, 
        FOREIGN KEY (anime_id) REFERENCES animes(id)
      );
`, (err) => {
        if (err) {
            throw err;
        }
    });
}

// 文章 主题 内容 次数
// 用户-选择的文章
if (1) {
    db.query(`
    CREATE TABLE IF NOT EXISTS texts_texts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        theme VARCHAR(255),
        content TEXT, 
        used INT, 
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        ok TINYINT DEFAULT '1'
    )
`, (err) => {
        if (err) {
            throw err;
        }
    });
    db.query(`
    CREATE TABLE IF NOT EXISTS texts_usertexts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      texts_id INT, 
      user_id INT, 
      FOREIGN KEY (texts_id) REFERENCES texts_texts(id), 
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
`, (err) => {
        if (err) {
            throw err;
        }
    });
}


// 聊天室人数计数
let onlineCount = 0;
// 解析json中间件
app.use(bodyParser.json());

// 图标
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'favicon.ico'))
});

// 图片资源
// TODO: 整理目录结构
app.use('/animes', (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(path.join(__dirname, 'animes')));

app.use('/cover', (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(path.join(__dirname, 'animes', 'cover')));

app.use('/upload', (req, res, next) => {
    if (1) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(path.join(__dirname, 'upload')));

// 文件资源
app.use('/file', (req, res, next) => {
    if (1) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(path.join(animePath, "files")));

// 视频资源
app.use('/a', (req, res, next) => {
    if (req.session.loggedin) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(animePath));

app.use('/public', (req, res, next) => {
    next();
}, express.static(path.join(__dirname, 'public')));

app.use('/score', (req, res, next) => {
    const pwd = req.query.pwd;
    if (pwd == "Lp7Tz9QxYw2RvE4F6NtG8HbJy5UdWzArX1Vc3M") {
        next();
    } else {
        res.status(500).send("无权限");
    }
}, express.static(path.join(__dirname, 'scores')));

// 种子目录
// TODO: 整理目录结构
app.use('/bittorrent', (req, res, next) => {
    if (1) {
        next();
    } else {
        res.status(403).json({ error: '无权限' });
    }
}, express.static(path.join(__dirname, 'downloads')));

// 首页路由
app.get('/', (req, res) => {
    if (req.session.loggedin) {
        if (req.session.target) {
            const target = req.session.target;
            req.session.target = undefined;
            res.redirect(target);
        } else {
            res.render('index', { nickname: req.session.nickname, perm: req.session.perm });
        }
    } else {
        res.redirect('/login');
    }
});

// 隐私声明
app.get('/privacystatement', (req, res) => {
    res.send('本网站仅作学习用途');
});

// chatroom 页面
app.get('/chatroom', (req, res) => {
    if (req.session.loggedin) {
        res.render('chatroom', { nickname: req.session.nickname });
    } else {
        req.session.target = '/chatroom';
        res.redirect('/login');
    }
});

// anime 索引页面
app.get('/animeindex', (req, res) => {
    if (req.session.loggedin) {
        res.render('animeindex', { nickname: req.session.nickname });
    } else {
        req.session.target = '/animeindex'
        res.redirect('/login');
    }
});

// anime 查看所有动漫 ?page=
app.get('/anime-search-all', (req, res) => {
    if (req.session.loggedin) {
        const page = req.query.page || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const query = 'SELECT * FROM animes ORDER BY start_date DESC LIMIT ? OFFSET ?';
        db.query(query, [limit, offset], (error, results) => {
            if (error) {
                console.error('查询数据库时发生错误：', error);
                res.status(500).json({ error: '无法获取数据' });
            } else {
                res.json(results);
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
})

// anime 搜索最近播放
app.get('/anime-search-r', (req, res) => {
    if (req.session.loggedin && isdig(req.query.page)) {
        const page = req.query.page || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const userid = req.session.userid;
        const query = `
            SELECT a.* FROM animelogs AS l JOIN animes AS a ON l.anime_id = a.id 
            WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?`;
        db.query(query, [userid, limit, offset], (error, results) => {
            if (error) {
                console.error('查询数据库时发生错误：', error);
                res.status(500).json({ error: '无法获取数据' });
            } else {
                res.json(results);
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 关键字搜索动漫 ?searchstr=&re=true
app.get('/anime-search-s', (req, res) => {
    if (req.session.loggedin) {
        const searchstr = decodeURIComponent(req.query.searchstr);
        if (req.query.re == 'true') {
            const query = `SELECT * FROM animes WHERE animename REGEXP ? LIMIT 50;`;
            db.query(query, [searchstr], (err, results) => {
                if (err) {
                    console.error(req.session.nickname, '查询数据库时发生错误：', err, '语句', query);
                    res.status(500).json({ error: '无法获取数据', msg: err, query: query });
                } else {
                    const queryA = `
                        SELECT a.* FROM animealias AS l JOIN animes AS a ON l.anime_id = a.id 
                        WHERE alias REGEXP ? LIMIT 50`;
                    db.query(queryA, [searchstr], (errA, resultsA) => {
                        if (err) {
                            console.error(req.session.nickname, '查询数据库时发生错误：', errA, '语句', queryA);
                            res.status(500).json({ error: '无法获取数据', msg: err, query: query });
                        } else {
                            const mergedResults = results.concat(resultsA);
                            const uniqueResults = mergedResults.reduce((acc, currentItem) => {
                                const foundItem = acc.find(item => item.id === currentItem.id);
                                if (!foundItem) { acc.push(currentItem); }
                                return acc;
                            }, []);
                            res.json(uniqueResults);
                        }
                    })
                }
            })
        } else {
            const query = `SELECT * FROM animes WHERE animename LIKE ? LIMIT 5;`;
            db.query(query, [searchstr], (err, results) => {
                if (err) {
                    console.error(req.session.nickname, '查询数据库时发生错误：', err, '语句', query);
                    res.status(500).json({ error: '无法获取数据' });
                } else {
                    const queryA = `
                        SELECT a.* FROM animealias AS l JOIN animes AS a ON l.anime_id = a.id 
                        WHERE alias LIKE ? LIMIT 20`;
                    db.query(queryA, [searchstr], (errA, resultsA) => {
                        if (err) {
                            console.error(req.session.nickname, '查询数据库时发生错误：', errA, '语句', queryA);
                            res.status(500).json({ error: '无法获取数据' });
                        } else {
                            const queryM = `SELECT * FROM animes WHERE animename LIKE ? LIMIT 40;`;
                            db.query(queryM, [`%${searchstr}%`], (errM, resultsM) => {
                                if (errM) {
                                    console.error(req.session.nickname, '查询数据库时发生错误：', errM, '语句', queryM);
                                    res.status(500).json({ error: '无法获取数据' });
                                } else {
                                    const queryAM = `
                                    SELECT a.* FROM animealias AS l JOIN animes AS a ON l.anime_id = a.id 
                                    WHERE alias LIKE ? LIMIT 50`;
                                    db.query(queryAM, [`%${searchstr}%`], (errAM, resultsAM) => {
                                        if (errAM) {
                                            console.error(req.session.nickname, '查询数据库时发生错误：', errAM, '语句', queryAM);
                                            res.status(500).json({ error: '无法获取数据' });
                                        } else {
                                            const mergedResults = results.concat(resultsA).concat(resultsM).concat(resultsAM);
                                            const uniqueResults = mergedResults.reduce((acc, currentItem) => {
                                                const foundItem = acc.find(item => item.id === currentItem.id);
                                                if (!foundItem) { acc.push(currentItem); }
                                                return acc;
                                            }, []);
                                            res.json(uniqueResults);
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 获取动漫数据 animename 和eps
app.get('/anime-get-data', (req, res) => {
    if (req.session.loggedin) {
        const animeid = req.query.id;
        let query = `SELECT animename FROM animes WHERE id = ?;`;
        if (req.session.perm >= 9000) {
            query = `SELECT animename, torrentreg FROM animes WHERE id = ?;`;
        }
        db.query(query, [animeid], (error, results) => {
            if (error) {
                res.json({ state: 'error', message: `Error fetching data ${error}` });
            } else {
                if (results.length > 0) {
                    const animename = results[0].animename;
                    const torrentreg = results[0].torrentreg;
                    const query_ep = `SELECT id, ep, path, ok FROM files WHERE anime_id = ?;`
                    db.query(query_ep, [animeid], (error, results) => {
                        if (error) {
                            res.json({ state: 'error', message: `Error fetching data ${error}` });
                        } else {
                            const episodes = results;
                            const responseData = {
                                state: 'ok',
                                data: {
                                    animename: animename,
                                    eps: episodes,
                                    torrentreg: torrentreg
                                },
                            };
                            res.json(responseData);
                            console.log(`[${getFormattedTimestamp()}][${req.session.nickname}]查询动漫数据: ${animename}`);
                        }
                    })
                } else {
                    res.status(404).json({ error: '没有对应的动漫' });
                }
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 获取动漫别称
app.get('/anime-get-alias', (req, res) => {
    if (req.session.loggedin) {
        const animeid = req.query.id;
        const query = `SELECT alias FROM animealias WHERE anime_id = ?;`;
        db.query(query, [animeid], (error, results) => {
            if (error) {
                res.json({ state: 'error', message: `Error fetching data ${error}` });
            } else {
                res.json({ results: results, perm: req.session.perm >= 11 });
            }
        })
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 添加动漫别称 需要权限10
app.get('/anime-add-alias', (req, res) => {
    if (req.session.loggedin) {
        if (req.session.perm >= 10) {
            const animeid = req.query.id;
            const uid = req.session.userid;
            const alias = decodeURIComponent(req.query.alias);
            if (alias) {
                const queryA = `SELECT id FROM animealias WHERE anime_id = ? AND alias = ?;`;
                db.query(queryA, [animeid, alias], (error, results) => {
                    if (error) {
                        res.json({ state: 'error', message: `Error fetching data ${error}` });
                    } else {
                        if (results.length == 0) {
                            const query = `INSERT INTO animealias (alias, anime_id, user_id) VALUES (?, ?, ?);`;
                            db.query(query, [alias, animeid, uid], (error, results) => {
                                if (error) {
                                    res.json({ state: 'DB error', error: `Error fetching data ${error}` });
                                } else {
                                    res.json({ state: 'ok' });
                                }
                            })
                        } else {
                            res.json({ error: '别称已存在' });
                        }
                    }
                })
            } else {
                res.json({ error: '别称不能为空' });
            }
        } else {
            res.status(403).json({ error: '无权限' });
        }
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 删除动漫别称 需要权限11
app.get('/anime-rm-alias', (req, res) => {
    if (req.session.loggedin) {
        if (req.session.perm >= 11) {
            const animeid = req.query.id;
            const uid = req.session.userid;
            const alias = decodeURIComponent(req.query.alias);
            if (alias) {
                const queryA = `DELETE FROM animealias WHERE anime_id = ? AND alias = ?;`;
                db.query(queryA, [animeid, alias], (error, results) => {
                    if (error) {
                        res.json({ state: 'error', message: `Error fetching data ${error}` });
                    } else {
                        res.json({ state: 'ok' });
                    }
                })
            } else {
                res.json({ error: '别称不能为空' });
            }
        } else {
            res.status(403).json({ error: '无权限' });
        }
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 根据mikan和bgm来更新别称 需要权限9000
app.get('/anime-update-alias', (req, res) => {
    const uid = req.session.userid;
    function updateAliasByBgmId(bgmid, animeid, res, msg = '') {
        axios.get(`https://bgm.tv/subject/${bgmid}`, { httpsAgent: httpProxy }).then(response => {
            const $ = cheerio.load(response.data);
            const liElements = $("#infobox li");
            const aliasList = [];
            liElements.each((index, element) => {
                const spanContent = $(element).find("span").text();
                if (spanContent === "别名: ") {
                    const listItemContent = $(element).text().replace("别名: ", "").trim();
                    aliasList.push(listItemContent);
                    const query = `SELECT id FROM animealias WHERE anime_id = ? AND alias = ?;`;
                    db.query(query, [animeid, listItemContent], (err, result) => {
                        if (err) {
                            res.json({ state: 'error', message: `Error fetching data ${err}` });
                        } else {
                            if (result.length == 0) {
                                const query = `INSERT INTO animealias (alias, anime_id, user_id) VALUES (?, ?, ?);`;
                                db.query(query, [listItemContent, animeid, uid], (error, results) => {
                                    if (error) {
                                        res.json({ state: 'DB error', error: `Error fetching data ${error}` });
                                    }
                                });
                            }
                        }
                    });
                } else if (spanContent === "话数: ") {

                }
            });
            res.json({ state: 'ok', message: `${msg} 添加了以下别称:${aliasList}` });
        }).catch(error => {
            res.json({ state: 'error', message: `请求页面https://bgm.tv/subject/${bgmid} 失败 ${error}` });
        });
    }
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const animeid = req.query.id;
        const query = `SELECT * FROM animes WHERE id = ?;`;
        db.query(query, [animeid], (err, result) => {
            if (err) {
                res.json({ state: 'error', message: `Error fetching data ${err}` });
            } else {
                if (result.length > 0) {
                    const anime = result[0];
                    if (anime.bgmid) {
                        updateAliasByBgmId(anime.bgmid, animeid, res);
                    } else if (anime.mkid) {
                        axios.get(`${mikanHost}/Home/Bangumi/${anime.mkid}`, { httpsAgent: httpProxy }).then(response => {
                            const $ = cheerio.load(response.data);
                            // $('.w-other-c').each((i, element) => {});
                            // const targetElementContent = $("#sk-container > div.pull-left.leftbar-container > p:nth-child(8) > a").text();
                            const bgmid = response.data.match(/bgm.tv\/subject\/(\d+)/);
                            if (bgmid) {
                                const queryA = `UPDATE animes SET bgmid = ? WHERE id = ?;`
                                db.query(queryA, [bgmid[1], animeid], (err, result) => {
                                    if (err) {
                                        res.json({ state: 'error', message: `Error fetching data ${err}` });
                                    } else {
                                        updateAliasByBgmId(bgmid[1], animeid, res, `anime_id=${animeid} (${anime.animename}) 通过mkid(${anime.mkid})更新了bgmid为${bgmid[1]}`);
                                    }
                                })
                            } else {
                                res.json({ state: 'error', message: `anime_id=${animeid} (${anime.animename}) ${mikanHost}/Home/Bangumi/${anime.mkid}未找到bgmid` });
                            }
                        }).catch(error => {
                            res.json({ state: 'error', message: `anime_id=${animeid} (${anime.animename}) 请求页面${mikanHost}/Home/Bangumi/${anime.mkid} 失败 ${error}` });
                        });
                    } else {
                        res.json({ state: 'error', message: `anime_id=${animeid} (${anime.animename}) 未关联mkid或者bgmid` });
                    }
                } else {
                    res.json({ state: 'error', message: `查询anime_id=${animeid}结果为空` });
                }
            }
        });
    } else {
        res.status(403).json({ state: 'error', message: '无权限' });
    }
})

// anime 添加吐槽 需要权限0 格式为{comment: '', animeid: ''}
app.post('/anime-add-comment', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 0)) {
        const data = req.body;
        const comment = data.comment;
        if (0 < comment.length < 10000) {
            const uid = req.session.userid;
            const query = `INSERT INTO animecomments (comment, anime_id, user_id) VALUES (?, ?, ?);`;
            db.query(query, [comment, data.animeid, uid], (err, result) => {
                if (err) {
                    res.json({ state: 'error', message: `Error fetching data ${err}` });
                } else {
                    res.json({ state: 'ok', message: result });
                }
            });
        } else {
            res.json({ state: 'error', message: `评论长度(${comment.length})超过限制(1-9999)` });
        }
    } else {
        res.status(403).json({ state: 'error', message: '无权限' });
    }
});

// anime 删除吐槽 需要自己发表或者权限1000 格式为?commentid=
app.get('/anime-rm-comment', (req, res) => {
    function delete_comment(cid, res) {
        const query = `UPDATE animecomments SET is_delete = 1, delete_date = current_timestamp() WHERE id = ?;`;
        db.query(query, [cid], (err, result) => {
            if (err) {
                res.json({ state: 'error', message: `Error fetching data ${err}` });
            } else {
                res.json({ state: 'ok', message: result });
            }
        })
    }
    if (req.session.loggedin) {
        const commentid = req.query.commentid;
        const uid = req.session.userid;
        if (req.session.perm >= 1000) {
            delete_comment(commentid, res);
        } else {
            const query = `SELECT user_id FROM animecomments WHERE id = ?;`
            db.query(query, [commentid], (err, result) => {
                if (err) {
                    res.json({ state: 'error', message: `Error fetching data ${err}` });
                } else {
                    if ((result.length > 0) && (result[0].user_id == uid)) {
                        delete_comment(commentid, res);
                    } else {
                        res.status(403).json({ error: '无权限' });
                    }
                }
            })
        }
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 获取吐槽 格式为?id=id&page=page
app.get('/anime-get-comment', (req, res) => {
    if (req.session.loggedin) {
        const delnNeedPerm = 1000;  // 返回是否能删除
        const page = req.query.page || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const animeid = req.query.id;
        const query = `
            SELECT animecomments.*, users.nickname, 
                CASE WHEN animecomments.user_id = ? OR ? >= ? THEN 1 ELSE 0 END AS can_del
            FROM animecomments
            INNER JOIN users ON animecomments.user_id = users.id
            WHERE anime_id = ? AND is_delete = 0
            ORDER BY date DESC LIMIT ? OFFSET ?;`;
        db.query(query, [req.session.userid, req.session.perm, delnNeedPerm, animeid, limit, offset], (error, results) => {
            if (error) {
                res.status(500).json({ state: 'error', message: `Error fetching data ${error}` });
            } else {
                res.json(results);
            }
        })
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 获取播放记录
app.get('/anime-get-playlog', (req, res) => {
    if (req.session.loggedin) {
        const animeid = req.query.id;
        const sql = `SELECT file_id FROM playlogs WHERE anime_id = ? AND user_id = ?;`;
        db.query(sql, [animeid, req.session.userid], (error, results) => {
            if (error) {
                console.error(req.session.nickname, '查询数据库时发生错误：', error, '语句', sql);
                res.status(500).json({ error: '无法获取数据' });
            } else {
                res.json({ state: 'ok', data: results });
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// anime 播放页面 权限10添加添加别称按钮
app.get('/animeplayer', (req, res) => {
    if (req.session.loggedin) {
        const animeid = req.query.id;
        res.render(`animeplayer`, { nickname: req.session.nickname, animeid: animeid, perm: req.session.perm });
    } else {
        req.session.target = '/animeindex';
        res.redirect('/login');
    }
});

// anime 记录播放信息
app.get('/animeplaylog', (req, res) => {
    if (req.session.loggedin) {
        const animeid = req.query.animeid;
        const fileid = req.query.fileid;
        const userid = req.session.userid;
        const sql = 'SELECT * FROM playlogs WHERE user_id = ? AND anime_id = ? AND file_id = ?';
        db.query(sql, [userid, animeid, fileid], (err, result) => {
            if (err) {
                console.log(err);
            } else {
                if (result.length) {
                    const sql = `UPDATE playlogs SET date = NOW() WHERE id = ?;`
                    db.query(sql, [userid], (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                } else {
                    const query_insert = `
                        INSERT INTO playlogs (user_id, anime_id, file_id, date)
                        VALUES (?, ?, ?, NOW());
                    `
                    db.query(query_insert, [userid, animeid, fileid], (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            }
        });
        const sql_animelog = `
            INSERT INTO animelogs (anime_id, user_id) 
            VALUES (?, ?) ON DUPLICATE KEY UPDATE date = NOW();`;
        db.query(sql_animelog, [animeid, userid], (err, result) => {
            if (err) {
                console.log(err);
            }
        });
        res.json({ state: 'ok', data: {} });
        console.log(`[${getFormattedTimestamp()}][${req.session.nickname}]记录了一条播放信息`);
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 更新所有未完结的动漫的最后更新日期 返回日志列表
app.get('/anime-update-all-date', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const query = `
            SELECT animes.id AS id, animes.animename AS name, animes.mkid AS mkid, stg.stgid AS stgid
            FROM animes INNER JOIN stg ON animes.stgid = stg.id
            WHERE animes.finished = 0;`;
        db.query(query, [], (err, results) => {
            if (err) {
                res.status(500).json({ state: 'error', message: `Error fetching data ${err}` });
            } else {
                const promises = [];
                function getDateFromMikan(result, index) {
                    return new Promise((resolve, reject) => {
                        if (result.mkid && result.stgid) {
                            const url = `${mikanHost}/Home/ExpandEpisodeTable?bangumiId=${result.mkid}&subtitleGroupId=${result.stgid}&take=10`;
                            axios.get(url, { httpsAgent: httpProxy }).then(response => {
                                const $ = cheerio.load(response.data);
                                let maxDate = null;
                                $('tbody').find('tr').each((index, tr) => {
                                    const thirdTdContent = $(tr).find('td:nth-child(3)').text();
                                    const currentDate = new Date(thirdTdContent);
                                    if (!maxDate || currentDate > maxDate) {
                                        maxDate = currentDate;
                                    }
                                });
                                const query = "UPDATE animes SET last_update = ? WHERE id = ?";
                                db.query(query, [maxDate, result.id], (err, resultA) => {
                                    if (err) {
                                        reject(`Error fetching data ${err}`);
                                    } else {
                                        resolve(`成功更新${result.name} 的日期为 ${formatDate(maxDate)}`);
                                    }
                                });
                            }).catch(error => {
                                reject(`请求页面 ${url} 失败 ${error}`);
                            });
                        } else {
                            reject(`${result} 无法查询`);
                        }
                    });
                }
                results.forEach((result, index) => {
                    promises.push(getDateFromMikan(result, index));
                });
                Promise.all(promises).then((data) => {
                    res.json(data);
                }).catch((error) => {
                    console.error('出错了:', error);
                    res.status(500).json({ error: '出错了' });
                });
            }
        });
    } else {
        res.status(403).json({ state: 'error', message: '无权限' });
    }
});

// -- anime 获取需要更新的动漫 ?page=
app.get('/anime-search-all-update', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const page = req.query.page || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const query = `
            SELECT * FROM animes 
            WHERE (file_date IS NULL OR (last_update IS NOT NULL AND file_date < last_update)) AND finished = 0
            ORDER BY start_date DESC LIMIT ? OFFSET ?`;
        db.query(query, [limit, offset], (error, results) => {
            if (error) {
                console.error('查询数据库时发生错误：', error);
                res.status(500).json({ error: '无法获取数据' });
            } else {
                res.json(results);
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 获取一个动漫的mikan资源 返回 { filename, xt, filesize, update_date, download_link } 列表 ?id=&take=50
app.get('/anime-mikan-update', (req, res) => {
    const animeid = req.query.id;
    const queryTake = req.query.take || 50;
    if (req.session.loggedin && (req.session.perm >= 9000) && (animeid)) {
        const query = `
            SELECT animes.* , stg.stgid AS sid
            FROM animes INNER JOIN stg ON animes.stgid = stg.id
            WHERE animes.id = ?`
        db.query(query, [animeid], (err, result) => {
            if (err) {
                console.error('查询数据库时发生错误：', err);
                res.status(500).json({ error: '无法获取数据' });
            } else {
                const anime = result[0];
                const url = `${mikanHost}/Home/ExpandEpisodeTable?bangumiId=${anime.mkid}&subtitleGroupId=${anime.sid}&take=${queryTake}`
                axios.get(url, { httpsAgent: httpProxy }).then(response => {
                    const $ = cheerio.load(response.data);
                    const dataList = [];
                    $('tbody tr').each((index, tr) => {
                        const filename = $(tr).find('.magnet-link-wrap').text().trim();
                        const xt = $(tr).find('td:nth-child(1) > a.js-magnet.magnet-link').attr('data-clipboard-text').match(/xt=urn:btih:(.*?)&/)[1];
                        const filesize = $(tr).find('td:nth-child(2)').text().trim();
                        const update_date = $(tr).find('td:nth-child(3)').text().trim();
                        const download_link = $(tr).find('td:nth-child(4) a').attr('href');
                        dataList.push({ filename, xt, filesize, update_date, download_link });
                    });
                    const query_inst = `INSERT IGNORE INTO bittorrent (xt, anime_id, filename, download_link, update_date, filesize, state) VALUES ?`;
                    const values = dataList.map(item => [item.xt, animeid, item.filename, item.download_link, new Date(item.update_date), parseFileSize(item.filesize), -1]);
                    db.query(query_inst, [values], (err, result_inst) => {
                        if (err) {
                            console.error('查询数据库时发生错误：', err);
                            res.status(500).json({ error: '无法获取数据' });
                        } else {
                            res.json({ dataList, result_inst });
                        }
                    })
                }).catch(error => {
                    res.status(403).json({ error: `请求页面 ${url} 失败 ${error}` });
                });
            }
        })
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 使用qbit api更新一部动漫 ?xt=
app.get('/anime-qbit-update', (req, res) => {
    const xt = req.query.xt;
    if (req.session.loggedin && (req.session.perm >= 9000) && xt) {
        const query = `SELECT bittorrent.*, animes.animename AS animename 
        FROM bittorrent INNER JOIN animes ON animes.id = bittorrent.anime_id 
        WHERE xt = ? AND state = -1`;
        db.query(query, [xt], (err, result) => {
            if (err) {
                console.error('查询数据库时发生错误：', err);
                res.status(500).json({ error: '无法获取数据' });
            } else if (result.length != 1) {
                res.status(500).json({ error: '无法获取数据, 数据长度不为1' });
            } else {
                const bittorrent = result[0];
                axios({
                    url: `${mikanHost}${bittorrent.download_link}`,
                    method: 'GET',
                    responseType: 'stream', // 指定响应类型为流
                    httpsAgent: httpProxy,
                }).then(response => {
                    // 创建可写流，将数据写入本地文件
                    const writer = fs.createWriteStream(path.resolve(`./downloads/${bittorrent.xt}.torrent`));
                    response.data.pipe(writer);

                    return new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                }).then(() => {
                    console.log(`./downloads/${bittorrent.xt}.torrent` + '文件下载完成');
                    const data = qs.stringify({
                        'urls': `https://127.0.0.1:${port}/bittorrent/${bittorrent.xt}.torrent`,
                        'savepath': path.join(animePath, bittorrent.animename).toString(),
                        'contentLayout': 'NoSubfolder',
                        'tags': bittorrent.animename,
                    });
                    const authHeader = {
                        Authorization: `Basic ${Buffer.from(`${qbittorrentConfig.username}:${qbittorrentConfig.password}`).toString('base64')}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.183'
                    };
                    const url = `${qbittorrentConfig.host}/api/v2/torrents/add`;
                    axios.post(url, data, { headers: authHeader }).then((response) => {
                        if (response.data == 'Ok.') {
                            const queryA = `UPDATE bittorrent SET state = 0 WHERE xt = ?;`
                            db.query(queryA, [xt], (err, result) => {
                                if (err) {
                                    console.error('查询数据库时发生错误：', err);
                                    res.status(500).json({ error: '无法获取数据' });
                                } else {
                                    res.json({ state: 'ok' });
                                }
                            })
                        } else {
                            res.json({ state: 'error', message: '添加种子失败' })
                        }
                    }).catch((error) => {
                        res.json({ state: 'error', message: error.toString() })
                    });
                }).catch(error => {
                    console.error('下载出错：', error);
                });
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 查询所有正在下载的种子 返回 { anime_id, animename, filename, xt, filesize, update_date, download_link, progress } 列表
app.get('/anime-qbit-progress', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const query = `SELECT a.*, l.animename FROM animes AS l JOIN bittorrent AS a ON l.id = a.anime_id WHERE state = 0`;
        db.query(query, [], (err, results) => {
            if (err) {
                console.error('查询数据库时发生错误：', err);
                res.status(500).json({ error: '无法获取数据' });
            } else if (results.length > 0) {
                const url = `${qbittorrentConfig.host}/api/v2/torrents/info`;
                axios.get(url).then((response) => {
                    const bittorrents = response.data.reduce((acc, item) => {
                        acc[item.hash] = item;
                        return acc;
                    }, {});
                    results.forEach((result, index) => {
                        result.filesize = formatFileSize(result.filesize);
                        result.update_date = formatDate(result.update_date);
                        const xt = result.xt;
                        if (bittorrents[xt]) {
                            result.progress = bittorrents[xt].progress;
                            const updateQuery = `UPDATE bittorrent SET progress = ?, path = ? WHERE xt = ?`
                            db.query(updateQuery, [bittorrents[xt].progress, bittorrents[xt].content_path, xt], () => { });
                        } else {
                            result.progress = -1;
                        }
                    });
                    res.json(results);
                }).catch((error) => {
                    res.json({ state: 'error', message: error.toString() })
                });

            } else {
                res.json([]);
            }
        })
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 更新下载完成的文件 写入files表 ?xt=&ep=
app.get('/anime-qbit-tofile', (req, res) => {
    const xt = req.query.xt;
    const ep = req.query.ep;
    if (req.session.loggedin && (req.session.perm >= 9000) && xt && ep) {
        const query = `SELECT * FROM bittorrent WHERE xt = ? AND state = 0 AND progress >= 1`
        db.query(query, [xt], (err, result) => {
            if (err) {
                console.error('查询数据库时发生错误：', err);
                res.status(500).json({ error: '无法获取数据' });
            } else if (result.length != 1) {
                res.status(500).json({ error: '数据长度不为1' });
            } else {
                const bittorrent = result[0];
                const quert_inst = `INSERT IGNORE INTO files (path, anime_id, ep) VALUES (?, ?, ?)`
                const path = isPathInsideDirectory(bittorrent.path, animePath, "/a");
                db.query(quert_inst, [path, bittorrent.anime_id, ep], (err, result_inst) => {
                    if (err) {
                        console.error('查询数据库时发生错误：', err);
                        res.status(500).json({ error: '无法获取数据' });
                    } else {
                        const updateQuery = `UPDATE bittorrent SET state = 1 WHERE xt = ?`
                        db.query(updateQuery, [xt], (err, result) => {
                            if (err) {
                                console.error('查询数据库时发生错误：', err);
                                res.status(500).json({ error: '无法获取数据' });
                            } else {
                                const query_update = `UPDATE animes SET file_date = NOW() WHERE id = ?`
                                db.query(query_update, [bittorrent.anime_id], (err, result) => {
                                    res.json({ state: 'ok', data: result_inst });
                                });
                            }
                        });
                    }
                });
            }
        });
    } else {
        res.status(403).json({ error: '无权限' });
    }
});

// -- anime 控制台路由
app.get('/animeconsole', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        res.render('animeconsole', { nickname: req.session.nickname });
    } else {
        res.status(403).send('权限不足');
    }
});

// 从bgm更新动漫数据
function getAnimeDatabgm(bgmid = -1, callback) {
    function _getAnimeData(bgmid) {
        return new Promise((resolve, reject) => {
            axios.get(`https://bgm.tv/subject/${bgmid}`).then(response => {
                const $ = cheerio.load(response.data);
                const liElements = $("#infobox li");
                const aliasList = [];
                liElements.each((index, element) => {
                    const promises = [];
                    const spanContent = $(element).find("span").text();
                    if (spanContent === "别名: ") {
                        const listItemContent = $(element).text().replace("别名: ", "").trim();
                        aliasList.push(listItemContent);
                        const query = `SELECT id, anime_id FROM animealias WHERE bgmid = ? AND alias = ?;`;
                        promises.push(new Promise((resolve, reject) => {
                            db.query(query, [bgmid, listItemContent], (err, result) => {
                                if (err) { reject(err); } else {
                                    if (result.length == 0) {
                                        const query = `INSERT INTO animealias (alias, anime_id) VALUES (?, ?, ?);`;
                                        db.query(query, [listItemContent, result.anime_id], (error, results) => {
                                            if (error) { reject(error); } else { resolve('ok'); }
                                        });
                                    }
                                }
                            });
                        }));
                    } else if (spanContent === "话数: ") {
                        const maxep = $(element).text().replace("话数: ", "").trim();
                        const query = "UPDATE animes SET maxep = ? WHERE bgmid = ?";
                        promises.push(new Promise((resolve, reject) => {
                            db.query(query, [maxep, bgmid], (err, result) => {
                                if (err) { reject(err); } else { resolve('ok'); }
                            });
                        }));
                    } else if (spanContent === "放送开始: ") {
                        const sda = $(element).text().replace("放送开始: ", "").trim();
                        const sd = new Date(sda.replace(/[年月]/g, '-').replace(/日/g, '')).toISOString().split('T')[0];
                        const query = "UPDATE animes SET start_date = ? WHERE bgmid = ?";
                        promises.push(new Promise((resolve, reject) => {
                            db.query(query, [sd, bgmid], (err, result) => {
                                if (err) { reject(err); } else { resolve('ok'); }
                            });
                        }));
                    }
                    Promise.all(promises).then((data) => {
                        resolve('完成');
                    }).catch((error) => {
                        reject(error);
                    });
                });
            }).catch(error => {
                console.log(`请求页面https://bgm.tv/subject/${bgmid} 失败 ${error}`);
            });
        });
    }
    if (bgmid == -1) {
        db.query("SELECT bgmid FROM animes", (err, results) => {
            if (err) { console.log(err); } else {
                const promises = [];
                results.forEach(result => {
                    if (result.bgmid) { promises.push(_getAnimeData(result.bgmid)); }
                    Promise.all(promises).then((logdata) => {
                        console.log(logdata);
                        if (typeof callback === 'function') { callback(); }
                    }).catch((error) => {
                        console.error('出错了:', error);
                    });
                });
            }
        });
    } else {
        _getAnimeData(bgmid).then(result => {
            console.log(result);
            if (typeof callback === 'function') { callback(); }
        }).catch(error => {
            console.error(error);
        });
    }
}

// 从mikan更新动漫数据
function getAnimeDatamk(mkid = -1, callback) {
    function _updateAnimes(mkid) {
        return new Promise((resolve, reject) => {
            axios.get(`${mikanHost}/Home/Bangumi/${mkid}`, { httpsAgent: httpProxy }).then(response => {
                const promises = [];
                const promises_a = []
                const $ = cheerio.load(response.data);
                const bgmid = response.data.match(/bgm.tv\/subject\/(\d+)/);
                const animename = $("#sk-container > div > p.bangumi-title").text();
                const stgs = $(".subgroup-text");
                if (animename) {
                    const queryA = `UPDATE animes SET animename = ? WHERE mkid = ?;`
                    promises.push(new Promise((resolve, reject) => {
                        db.query(queryA, [animename, mkid], (err, result) => {
                            if (err) { reject(err); } else { resolve('ok'); }
                        });
                    }));

                }
                if (bgmid) {
                    const queryA = `UPDATE animes SET bgmid = ? WHERE mkid = ?;`
                    promises.push(new Promise((resolve, reject) => {
                        db.query(queryA, [bgmid[1], mkid], (err, result) => {
                            if (err) { reject(err); } else { resolve('ok'); }
                        })
                    }));
                } else {
                    reject(`${mikanHost}/Home/Bangumi/${mkid}未找到bgmid`);
                }
                if (stgs) {
                    stgs.each((index, el) => {
                        const element = $(el);
                        const stgid = element.attr('id');
                        const stgname = element.find('a:first').text();
                        const stgurlm = element.find('a:first').attr('href').match(/.*\/(\d+)$/);
                        const stgurl = stgurlm ? stgurlm[1] : 0;
                        const stgfile = element.next().find('a:first').text();
                        const query = "INSERT IGNORE INTO stg (name, url, stgid) VALUES (?, ?, ?)";
                        promises.push(new Promise((resolve, reject) => {
                            db.query(query, [stgname, stgurl, stgid], (err, result) => {
                                if (err) { reject(err); } else { resolve('ok'); }
                            });
                        }));
                        const query_animetag = `
                            INSERT IGNORE INTO animestg (anime_id, stg_id, files)
                            SELECT a.id, s.id, ? FROM animes AS a
                            JOIN stg AS s ON s.stgid = ? 
                            WHERE a.mkid LIKE ?`
                        promises_a.push(new Promise((resolve, reject) => {
                            db.query(query_animetag, [stgfile, stgid, mkid], (err, result) => {
                                if (err) { reject(err); } else { resolve('ok'); }
                            });
                        }));
                    });
                }
                const coverurl = response.data.match(/url\('(.*?)\.jpg'\);/);
                const filename = coverurl[1].match(/.*\/(.*?)$/)[1] + ".jpg";
                const filepath = `./animes/cover/${filename}`;
                if (coverurl && !fs.existsSync(filepath)) {
                    promises.push(new Promise((resolve, reject) => {
                        axios({  // 下载图片
                            url: `${mikanHost}${coverurl[1]}.jpg`,
                            method: 'GET',
                            responseType: 'stream', // 指定响应类型为流
                            httpsAgent: httpProxy,
                        }).then(response => {
                            const writer = fs.createWriteStream(path.resolve(filepath));
                            response.data.pipe(writer);
                            return new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });
                        }).then(() => {
                            console.log('下载封面完成');
                            const query = `UPDATE animes SET coverurl = ? WHERE mkid = ?;`
                            db.query(query, [`/cover/${filename}`, mkid], (err, result) => {
                                if (err) { reject(err); } else { resolve('ok'); }
                            });
                        }).catch(error => {
                            console.error(error);
                            reject(error);
                        });
                    }));
                } else {
                    const query = `UPDATE animes SET coverurl = ? WHERE mkid = ?;`
                    db.query(query, [`/cover/${filename}`, mkid], (err, result) => {
                        if (err) { reject(err); } else { resolve('ok'); }
                    });
                }
                Promise.all(promises).then(() => {
                    Promise.all(promises_a).then(() => {
                        resolve({ animename: animename });
                    }).catch((error) => {
                        reject(error);
                    });
                }).catch((error) => {
                    reject(error);
                });
            }).catch(error => {
                reject(`请求页面${mikanHost}/Home/Bangumi/${mkid} 失败 ${error}`);
            });
        });
    }
    if (mkid == -1) {
        db.query("SELECT mkid FROM animes", (err, results) => {
            if (err) { console.log(err); } else {
                const promises = [];
                results.forEach(result => {
                    if (result.mkid) {
                        promises.push(_updateAnimes(result.mkid));
                    }
                });
                Promise.all(promises).then((logdata) => {
                    console.log(logdata);
                    if (typeof callback === 'function') { callback(animename = logdata); }
                }).catch((error) => {
                    console.error('出错了:', error);
                });
            }
        });
    } else {
        _updateAnimes(mkid).then(result => {
            console.log(result);
            if (typeof callback === 'function') { callback(animename = result); }
        }).catch(error => {
            console.error(error);
        });
    }
}

// mikan搜索动漫
app.get('/temp', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {

    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// mikan搜索动漫
app.get('/anime-mk-search', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const str = req.query.str;
        axios.get(`${mikanHost}/Home/Search?searchstr=${str}`, { httpsAgent: httpProxy }).then(response => {
            const $ = cheerio.load(response.data);
            const datas = [];
            const elements = $("#sk-container > div.central-container > ul > li");
            elements.each((index, el) => {
                const element = $(el);
                datas.push({
                    animename: element.find(".an-text").text(),
                    mkid: element.find('a').attr('href').match(/(\d+)$/)[1]
                });
            });
            const query = `SELECT mkid FROM animes`;
            db.query(query, [], (err, results) => {
                if (err) { console.error(err); res.status(500).json({ state: "error" }) } else {
                    const mkidList = results.map((item) => { return item.mkid });
                    const mkidSet = new Set(mkidList);
                    datas.forEach((data) => {
                        if (mkidSet.has(data.mkid)) {
                            data.inDb = 1;
                        } else {
                            data.inDb = 0;
                        }
                    });
                    res.json(datas);
                }
            });
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// mikan 添加动漫 ?mkid=
app.get('/anime-mk-add', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.mkid;
        const query = "INSERT IGNORE INTO animes (mkid) VALUES (?)";
        db.query(query, [mkid], (err, result) => {
            if (err) { console.error(err); } else {
                getAnimeDatamk(mkid, (animename) => {
                    const query = "SELECT bgmid FROM animes WHERE mkid = ?";
                    db.query(query, [mkid], (err, result) => {
                        if (err) { console.error(err); } else {
                            const bgmid = result[0].bgmid;
                            getAnimeDatabgm(bgmid, () => {
                                sendSystemMessage(`新增了动漫: ${animename.animename}`);
                                res.json({ state: "ok", anime: animename });
                            });
                        }
                    });
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// mikan 删除动漫 ?id=
app.get('/anime-mk-rm', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.id;
        const query_a = "DELETE FROM animestg WHERE anime_id = ?;";
        db.query(query_a, [mkid], (err, result) => {
            if (err) {
                console.error(err);
                res.json({ state: "false", msg: "删除失败" });
            } else {
                const query = "DELETE FROM animes WHERE id = ?;";
                db.query(query, [mkid], (err, result) => {
                    if (err) {
                        console.error(err);
                        res.json({ state: "false", msg: "删除失败" });
                    } else {
                        res.json({ state: "ok", msg: "删除成功" });
                    }
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 查询所有未绑定字幕组的动漫
app.get('/anime-nobindstg', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const query = "SELECT * FROM animes WHERE stgid IS NULL";
        db.query(query, [], (err, result) => {
            if (err) { console.error(err); } else {
                res.json(result);
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 查询所有未绑定种子正则的动漫
app.get('/anime-nobindbre', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const query = `
            SELECT a.id, a.animename, s.files FROM animes AS a 
            JOIN animestg AS s ON s.anime_id = a.id AND s.stg_id = a.stgid
            WHERE torrentreg IS NULL OR torrentreg = ''`;
        db.query(query, [], (err, result) => {
            if (err) { console.error(err); } else {
                res.json(result);
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// mikan 查询一个未绑定字幕组的动漫的字幕组及其最近10个文件 以此来选择字幕组
app.get('/anime-getstg', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.mkid;
        const id = req.query.id;
        const query = `
            SELECT stg.*, animes.mkid as mkid FROM stg
            JOIN animes ON animes.${mkid ? "mkid" : "id"} = ?
            JOIN animestg AS at ON at.stg_id = stg.id AND at.anime_id = animes.id`;
        db.query(query, [mkid ? mkid : id], (err, results) => {
            if (err) {
                console.log(err);
                res.json({ state: 'error' });
            } else {
                const promises = [];
                results.forEach((result) => {
                    promises.push(
                        new Promise((resolve, reject) => {
                            const url = `${mikanHost}/Home/ExpandEpisodeTable?bangumiId=${result.mkid}&subtitleGroupId=${result.stgid}&take=10`;
                            axios.get(url, { httpsAgent: httpProxy }).then(response => {
                                const filelist = [];
                                const $ = cheerio.load(response.data);
                                const table = $(".magnet-link-wrap").each((index, el) => {
                                    const element = $(el);
                                    filelist.push(element.text());
                                });
                                result.files = filelist;
                                resolve(table);
                            }).catch((err) => { reject(err); });
                        })
                    );
                });
                Promise.all(promises).then((data) => {
                    res.json(results);
                }).catch((error) => {
                    console.error(error);
                    res.status(500).json({ error: '出错了' });
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 将一个动漫绑定一个字幕组
app.get('/anime-bindstg', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.mkid;
        const id = req.query.id;
        const stgid = req.query.stgid;  // 这里是stg.id而非stg.stgid
        const query = `UPDATE animes SET stgid = ? WHERE ${mkid ? "mkid" : "id"} = ?`;
        db.query(query, [stgid, (mkid ? mkid : id)], (err, result) => {
            if (err) {
                console.log(err);
                res.json({ state: 'error' });
            } else {
                res.json({ state: 'ok' });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 将一个动漫种子绑定一个正则 以此来匹配需要下载的文件
app.get('/anime-bindtorrentreg', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.mkid;
        const id = req.query.id;
        const re = req.query.re;
        const query = `UPDATE animes SET torrentreg = ? WHERE ${mkid ? "mkid" : "id"} = ?`;
        db.query(query, [re, (mkid ? mkid : id)], (err, result) => {
            if (err) {
                console.log(err);
                res.json({ state: 'error' });
            } else {
                res.json({ state: 'ok' });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 将一个动漫文件绑定一个正则 以此来匹配需要显示的文件
app.get('/anime-bindfilereg', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const mkid = req.query.mkid;
        const id = req.query.id;
        const re = req.query.re;  // 这里是stg.id而非stg.stgid
        const query = `UPDATE animes SET filereg = ? WHERE ${mkid ? "mkid" : "id"} = ?`;
        db.query(query, [re, (mkid ? mkid : id)], (err, result) => {
            if (err) {
                console.log(err);
                res.json({ state: 'error' });
            } else {
                res.json({ state: 'ok' });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 将所有状态为-1的种子下载到本地 并添加到qbittorrent
function updateNoDownloadBittorrent(callback) {
    const query = "SELECT b.*, a.animename AS animename FROM bittorrent AS b JOIN animes AS a ON a.id = b.anime_id WHERE b.state = -1";
    db.query(query, [], (err, result) => {
        if (err) { console.log(err) } else {
            const promises = [];
            result.forEach((bittorrent) => {
                promises.push(new Promise((resolve, reject) => {
                    axios({
                        url: `${mikanHost}${bittorrent.download_link}`,
                        method: 'GET',
                        responseType: 'stream', // 指定响应类型为流
                        httpsAgent: httpProxy,
                    }).then(response => {
                        const writer = fs.createWriteStream(path.resolve(`./downloads/${bittorrent.xt}.torrent`));
                        response.data.pipe(writer);
                        return new Promise((resolve, reject) => {
                            writer.on('finish', resolve);
                            writer.on('error', reject);
                        });
                    }).then(() => {
                        console.log(`./downloads/${bittorrent.xt}.torrent` + '文件下载完成');
                        const data = qs.stringify({
                            'urls': `https://127.0.0.1:${port}/bittorrent/${bittorrent.xt}.torrent`,
                            'savepath': path.join(animePath, bittorrent.animename).toString(),
                            'contentLayout': 'NoSubfolder',
                            'tags': bittorrent.animename,
                        });
                        const url = `${qbittorrentConfig.host}/api/v2/torrents/add`;
                        axios.post(url, data, {}).then((response) => {
                            if (response.data == 'Ok.') {
                                const queryA = `UPDATE bittorrent SET state = 0 WHERE xt = ?;`
                                db.query(queryA, [bittorrent.xt], (err, result) => {
                                    if (err) {
                                        console.error('查询数据库时发生错误：', err);
                                        reject({ error: '无法获取数据' });
                                    } else {
                                        resolve({ state: 'ok' });
                                    }
                                });
                            } else {
                                // TODO: 这里应该是把种子下载到本地失败了导致qbit无法找到文件 目前是删除数据库条目等待下次下载 有优化空间
                                const query = "DELETE FROM bittorrent WHERE xt = ?";
                                db.query(query, [bittorrent.xt], (err, result) => {
                                    if (err) { console.error(err); } else {
                                        reject({ state: 'error', message: '添加种子失败 已删除种子条目' })
                                    }
                                });
                            }
                        }).catch((error) => {
                            reject({ state: 'error', message: error.toString() })
                        });
                    }).catch(error => {
                        console.error('下载出错：', error);
                        reject(error);
                    });
                }));
            });
            Promise.all(promises).then((data) => {
                sendSystemMessage(`开始下载种子文件 新增了${data.length}个下载任务`);
                if (typeof callback === 'function') { callback(data); }
            }).catch((error) => {
                console.log(error);
                if (typeof callback === 'function') { callback(error); }
            });
        }
    });
}

// 在qbittorrent查询种子 并更新数据库
function updateDownliadingBittorrent(callback) {
    const url = `${qbittorrentConfig.host}/api/v2/torrents/info`;
    axios.get(url).then((response) => {
        const bittorrents = response.data.reduce((acc, item) => {
            acc[item.hash] = item;
            return acc;
        }, {});
        let query_data = '';
        Object.entries(bittorrents).forEach(([xt, bittorrent]) => {
            query_data = query_data + `WHEN xt = '${xt}' AND path IS NULL AND state = 0 THEN ${bittorrent.progress} \n`;
        });
        const query = `UPDATE bittorrent SET progress = CASE \n${query_data} ELSE progress END;`
        db.query(query, [], (err, result) => {  // 更新所有的种子的下载进度
            if (err) { console.error(err); } else {
                // 把所有下载完的状态设为1 
                const query = "UPDATE bittorrent SET state = 1 WHERE state = 0 AND progress >= 1";
                db.query(query, [], (err, result) => {
                    if (err) { console.log(err); } else {
                        const msg = `将${result.affectedRows}个种子设为下载完成`;
                        if (result.affectedRows > 0) { sendSystemMessage(msg); }
                        if (typeof callback === 'function') { callback(msg); }
                    }
                });
            }
        });
    }).catch((error) => {
        console.log(error);
    });
}

// 通过id自动更新一部动漫的种子文件 
// 自动更新需要动漫存在mkid, stgid, torrentreg 且种子数小于maxep
// 默认情况下自动更新只查看最近的10个文件
function animeUpdateBittorrent(animeid, take, auto = true, callback) {
    function _animeUpdate(animeid) {
        return new Promise((resolve, reject) => {
            let query = "SELECT a.mkid, stg.stgid, a.torrentreg FROM animes AS a JOIN stg ON stg.id = a.stgid WHERE a.id = ?";
            if (auto) {
                query = query + " AND a.mkid != '' AND a.stgid IS NOT NULL AND a.torrentreg != '' AND COALESCE(a.bittorrentcount, 0) < a.maxep";
            }
            db.query(query, [animeid], (err, results) => {
                if (err) { reject(err); } else {
                    const result = results[0];
                    const url = `${mikanHost}/Home/ExpandEpisodeTable?bangumiId=${result.mkid}&subtitleGroupId=${result.stgid}&take=${take ? take : 10}`;
                    axios.get(url, { httpsAgent: httpProxy }).then(response => {
                        const $ = cheerio.load(response.data);
                        const query_inst = "INSERT IGNORE INTO bittorrent (xt, anime_id, filename, download_link, update_date, filesize, state) VALUES ?";
                        const dataList = [];
                        $('tbody tr').each((index, tr) => {
                            const filename = $(tr).find('.magnet-link-wrap').text().trim();
                            const xt = $(tr).find('td:nth-child(1) > a.js-magnet.magnet-link').attr('data-clipboard-text').match(/xt=urn:btih:(.*?)&/)[1];
                            const filesize = $(tr).find('td:nth-child(2)').text().trim();
                            const update_date = $(tr).find('td:nth-child(3)').text().trim();
                            const download_link = $(tr).find('td:nth-child(4) a').attr('href');
                            if (filename.match(new RegExp(result.torrentreg))) {
                                dataList.push({ filename, xt, filesize, update_date, download_link });
                            }
                        });
                        if (dataList) {
                            const values = dataList.map(item => [item.xt, animeid, item.filename, item.download_link, new Date(item.update_date), parseFileSize(item.filesize), -1]);
                            db.query(query_inst, [values], (err, result_inst) => {
                                if (err) {
                                    console.error(err);
                                    reject({ error: '无法获取数据' });
                                } else {  // 更新动漫的种子数 为关联到他的种子数
                                    const query = `
                                    UPDATE animes
                                    SET bittorrentcount = (SELECT COUNT(*) FROM bittorrent AS b WHERE b.anime_id = animes.id)
                                    WHERE id = ?
                                `;
                                    db.query(query, [animeid], (err, result) => {
                                        if (err) { reject(err); } else {
                                            resolve(`查询到${dataList.length}个种子 添加了${result_inst.affectedRows}个种子`);
                                        }
                                    });
                                }
                            });
                        } else {
                            resolve('没有找到匹配的文件');
                        }
                    });
                }
            });
        });
    }
    if (typeof (animeid) == 'undefined') {
        const query = "SELECT id FROM animes WHERE mkid != '' AND stgid IS NOT NULL AND torrentreg != '' AND bittorrentcount < maxep";
        db.query(query, [], (err, results) => {
            if (err) { console.log(err) } else {
                const promises = [];
                results.forEach((result) => {
                    promises.push(_animeUpdate(result.id));
                });
                Promise.all(promises).then((data) => {
                    console.log(data);
                    sendSystemMessage(`更新了所有动漫的种子文件: ${data}`);
                    if (typeof callback === 'function') { callback(data); }
                });
            }
        });
    } else {
        _animeUpdate(animeid).then((data) => {
            console.log(data);
            sendSystemMessage(`更新了动漫的种子文件: ${data}`);
            if (typeof callback === 'function') { callback(data); }
        });
    }
}

// 更新一部动漫的种子文件
app.get('/anime-updatebittorrent', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const animeid = req.query.animeid;
        const take = req.query.take || 10;
        animeUpdateBittorrent(animeid, take, false, (data) => {
            res.json({ state: "ok", msg: data });
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 手动管理动漫的种子文件: 查询全部(100个)种子 ?animeid=&take=100
app.get('/anime-searchtorrent', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const animeid = req.query.animeid;
        const take = req.query.take || 100;
        const query = "SELECT a.mkid, stg.stgid FROM animes AS a JOIN stg ON stg.id = a.stgid WHERE a.id = ?";
        db.query(query, [animeid], (err, results) => {
            if (err) { console.error(err); } else {
                const result = results[0];
                const url = `${mikanHost}/Home/ExpandEpisodeTable?bangumiId=${result.mkid}&subtitleGroupId=${result.stgid}&take=${take}`;
                axios.get(url, { httpsAgent: httpProxy }).then(response => {
                    const $ = cheerio.load(response.data);
                    const query_inst = "INSERT IGNORE INTO bittorrent (xt, anime_id, filename, download_link, update_date, filesize, state) VALUES ?";
                    const dataList = [];
                    $('tbody tr').each((index, tr) => {
                        const filename = $(tr).find('.magnet-link-wrap').text().trim();
                        const xt = $(tr).find('td:nth-child(1) > a.js-magnet.magnet-link').attr('data-clipboard-text').match(/xt=urn:btih:(.*?)&/)[1];
                        const filesize = $(tr).find('td:nth-child(2)').text().trim();
                        const update_date = $(tr).find('td:nth-child(3)').text().trim();
                        const download_link = $(tr).find('td:nth-child(4) a').attr('href');
                        dataList.push({ filename, xt, filesize, update_date, download_link });
                    });
                    if (dataList) {
                        const values = dataList.map(item => [item.xt, animeid, item.filename, item.download_link, new Date(item.update_date), parseFileSize(item.filesize), -2]);
                        db.query(query_inst, [values], (err, result_inst) => {
                            if (err) {
                                console.error(err);
                                res.json({ error: '无法获取数据' });
                            } else {  // 更新动漫的种子数 为关联到他的状态不为-2的种子数
                                const query = `
                                UPDATE animes
                                SET bittorrentcount = (SELECT COUNT(*) FROM bittorrent AS b WHERE b.anime_id = animes.id AND b.state > -2)
                                WHERE id = ?
                            `;
                                db.query(query, [animeid], (err, result) => {
                                    if (err) { console.error(err); } else {
                                        const query = "SELECT xt, state FROM bittorrent";
                                        db.query(query, [], (err, results) => {
                                            if (err) { console.error(err); } else {
                                                const result = results.reduce((acc, item) => ({ ...acc, [item.xt]: item.state }), {});
                                                dataList.forEach((item) => {
                                                    item.state = result[item.xt]
                                                });
                                                updateDownliadingBittorrent(() => {
                                                    const query = "SELECT xt, progress FROM bittorrent WHERE anime_id = ?";
                                                    db.query(query, [animeid], (err, results) => {
                                                        if (err) { console.error(err); } else {
                                                            const progressObj = results.reduce((acc, item) => ({ ...acc, [item.xt]: item.progress }), {});
                                                            dataList.forEach((data) => {
                                                                data.progress = progressObj[data.xt];
                                                            });
                                                            res.json(dataList);
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        res.json(['没有找到匹配的文件']);
                    }
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 手动管理动漫的种子文件: 添加一个种子文件 ?xt=
app.get('/anime-addtorrent', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const xt = req.query.xt;
        const query = "UPDATE bittorrent SET state = -1 WHERE xt = ?";
        db.query(query, [xt], (err, result) => {
            if (err) { console.error(err); } else {
                res.json({ state: "ok", meg: `影响了${result.affectedRows}行` })
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 开始下载种子文件 对于所有状态为-1的种子 添加到qbit并改为0
app.get('/anime-downloadbittorrent', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        updateNoDownloadBittorrent((data) => {
            res.json({ state: "ok", msg: data });
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 更新所有下载中种子的下载进度
app.get('/anime-updatedownloadingbittorrent', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        updateDownliadingBittorrent((data) => {
            res.json({ state: "ok", msg: data });
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 正则匹配文件
function findFirstFileMatchingRegex(directory, regexPattern) {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, (err, files) => {
            if (err) {
                reject(err);
            } else {
                const caseInsensitiveRegex = new RegExp(regexPattern, 'i');
                const matchingFile = files.find(file => caseInsensitiveRegex.test(file));
                if (matchingFile) {
                    const filePath = path.join(directory, matchingFile);
                    resolve(filePath);
                } else {
                    resolve(undefined);
                }
            }
        });
    });
}


let updating = false;
// 更新文件 
// 获取数据库文件列表 获取本地文件列表 比较差异 获取新增文件ffmpeg数据 如果合理则添加
function updateFiles(callback) {
    if (updating) {
        console.log("更新任务正在进行 跳过本次任务");
        if (typeof callback === 'function') { callback("更新任务正在进行 跳过本次任务"); }
        return
    }
    updating = true;
    const query = "SELECT localpath FROM files";
    db.query(query, [], (err, results) => {
        if (err) {
            console.error(err);
            if (typeof callback === 'function') { callback(err); }
        } else {
            const dbfiles = results.map((result) => { return result.localpath });
            const newfiles = [];
            function traverseDirectory(directory) {  // 递归遍历目录
                const files = fs.readdirSync(directory);
                files.forEach(file => {
                    const filePath = path.join(directory, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        // 递归遍历子目录
                        traverseDirectory(filePath);
                    } else if (stats.isFile()) {
                        // 打印相对于父目录的路径
                        if (stats.size === 0) {
                            // 如果文件大小为0，删除文件
                            fs.unlinkSync(filePath);
                            console.log(`删除无效文件: ${filePath}`);
                        } else {
                            const relativePath = path.relative(animePath, filePath);
                            const fileInfo = path.parse(relativePath);
                            const videoExt = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.mpeg', '.3gp', '.webm', '.ogg', '.rm', '.ts', '.divx', '.vob', '.mpg']);
                            if (videoExt.has(fileInfo.ext)) {
                                if (!(dbfiles.includes(relativePath))) {
                                    newfiles.push(relativePath);
                                }
                            }
                        }
                    }
                });
            }
            traverseDirectory(animePath);
            if (newfiles.length > 0) {
                let successFiles = 0;
                const addFiles = [];
                console.log(`新增${newfiles.length}个文件 开始更新文件: ` + newfiles.join('\n'));
                // sendSystemMessage(`新增${newfiles.length}个文件 开始更新文件`);
                if (typeof callback === 'function') { callback(`新增${newfiles.length}个文件 开始更新文件`); }
                async function executeCommands() {
                    for (const file of newfiles) {
                        const filePath = path.join(animePath, file);
                        const ffmpegCommand = `${ffmpegPath} -i "${filePath}"`;
                        try {
                            await exec(ffmpegCommand);
                        } catch (error) {
                            // 期待ffmpeg提示未指定输出
                            if (error.message.match(/At least one output file must be specified\s*$/)) {
                                const ffmpegInfo = error.toString();
                                const VideoEncodeingMatch = ffmpegInfo.match(/Stream.*?Video:\s(.*?)\s.*\(default\)/);
                                if (VideoEncodeingMatch) {
                                    let ffmpegCommand = '';
                                    const VideoEncodeing = VideoEncodeingMatch[1];  // 视频画面编码格式需要转为h264
                                    const fileInfo = path.parse(filePath);
                                    const fileName = fileInfo.name;
                                    const fileExt = fileInfo.ext;
                                    const filename = fileName + fileExt;
                                    const fileDir = fileInfo.dir;
                                    const basepath = path.parse(file).dir;
                                    const animename = basepath.toString().replace(/\\/g, '/');
                                    const baseanimename = basepath.split(path.sep)[0];
                                    const query_insert = `
                                        INSERT INTO files (path, localpath, anime_id, ep, ok) 
                                        SELECT ?, ?, id, ?, ? FROM animes WHERE animes.animename = ?
                                    `;
                                    const webPath = `/a/${file.toString().replace(/\\/g, '/')}`;
                                    let assFile = undefined;  // 如果有外挂字幕需要嵌入
                                    if (fs.existsSync(path.join(fileDir, `${fileName}.ass`))) {
                                        assFile = path.join(fileDir, `${fileName}.ass`)
                                    } else if (fs.existsSync(path.join(fileDir, `${fileName}.sc.ass`))) {
                                        assFile = path.join(fileDir, `${fileName}.sc.ass`)
                                    } else if (fs.existsSync(path.join(fileDir, `${fileName}.SC.ass`))) {
                                        assFile = path.join(fileDir, `${fileName}.SC.ass`)
                                    } else if (fs.existsSync(path.join(fileDir, `${fileName}.chs.ass`))) {
                                        assFile = path.join(fileDir, `${fileName}.chs.ass`)
                                    } else if (fs.existsSync(path.join(fileDir, `${fileName}.CHS.ass`))) {
                                        assFile = path.join(fileDir, `${fileName}.CHS.ass`)
                                    } else {
                                        try {
                                            assFile = await findFirstFileMatchingRegex(fileDir, `^${fileName.replace(/[\/.*+?^${}()|[\]\\]/g, '\\$&')}(\..*((sc)|(chs)).*)?.ass$`);
                                        } catch (error) {
                                            console.error(error);
                                        }
                                    }
                                    if (ffmpegInfo.match(/Stream .*? Subtitle: .*? \(default\)/)) {  // 存在内嵌字幕
                                        const promise = new Promise(async (resolve, reject) => {
                                            db.query(query_insert, [webPath, file, fileName, '0', baseanimename], (err, result) => {
                                                if (err) { reject(err); }
                                            });
                                            const outputFilePatch = path.join(fileDir, `${fileName}[ToH264].mp4`);
                                            ffmpegCommand = `${ffmpegPath} -i "${filename}" -c:v ${ffmpegEncoding} -c:a aac -vf "subtitles='${filename}':si=0" ${ffmpegExtra} "${outputFilePatch}" -n`;
                                            if (!fs.existsSync(outputFilePatch)) {
                                                try {
                                                    console.log("开始ffmpeg转码: " + ffmpegCommand);
                                                    sendSystemMessage("开始ffmpeg转码: " + fileName);
                                                    await exec(ffmpegCommand, { cwd: fileDir });
                                                    console.log("ffmpeg转码完成");
                                                    sendSystemMessage("ffmpeg转码完成");
                                                } catch (error) {
                                                    reject(error);
                                                }
                                            }
                                            const webPath2 = `/a/${animename}/` + `${fileName}[ToH264].mp4`;
                                            const file2 = path.join(animename, `${fileName}[ToH264].mp4`);
                                            db.query(query_insert, [webPath2, file2, `${fileName}[ToH264]`, '1', baseanimename], (err, result) => {
                                                if (err) { reject(err); } else { resolve('ok'); }
                                            });
                                        });
                                        try { await promise; } catch (error) { console.error(error); }
                                    } else if (assFile) { // 存在外挂字幕
                                        const promise = new Promise(async (resolve, reject) => {
                                            db.query(query_insert, [webPath, file, fileName, '0', baseanimename], (err, result) => {
                                                if (err) { reject(err); }
                                            });
                                            fs.copyFile(assFile, path.join(fileDir, 'tmp.ass'), async (error) => {
                                                if (error) { reject(error); }
                                                const outputFilePatch = path.join(fileDir, `${fileName}[ToH264].mp4`);
                                                ffmpegCommand = `${ffmpegPath} -i "${filePath}" -vf "ass=tmp.ass" -c:v ${ffmpegEncoding} -c:a aac ${ffmpegExtra} "${outputFilePatch}" -n`;
                                                if (!fs.existsSync(outputFilePatch)) {
                                                    try {
                                                        console.log("开始ffmpeg转码: " + ffmpegCommand + "\n外挂字幕: " + assFile);
                                                        sendSystemMessage("开始ffmpeg转码: " + fileName + "\n外挂字幕: " + assFile);
                                                        await exec(ffmpegCommand, { cwd: fileDir });
                                                        console.log("ffmpeg转码完成");
                                                        sendSystemMessage("ffmpeg转码完成");
                                                    } catch (error) {
                                                        reject(error);
                                                    }
                                                }
                                                const webPath2 = `/a/${animename}/` + `${fileName}[ToH264].mp4`;
                                                const file2 = path.join(animename, `${fileName}[ToH264].mp4`);
                                                db.query(query_insert, [webPath2, file2, `${fileName}[ToH264]`, '1', baseanimename], (err, result) => {
                                                    if (err) { reject(err); } else { resolve('ok'); }
                                                });
                                            });

                                        });
                                        try { await promise; } catch (error) { console.error(error); }
                                    } else if ((VideoEncodeing != 'h264') || (fileExt != '.mp4')) {  // 没有额外字幕 但是格式非h264
                                        const promise = new Promise(async (resolve, reject) => {
                                            db.query(query_insert, [webPath, file, fileName, '0', baseanimename], (err, result) => {
                                                if (err) { reject(err); }
                                            });
                                            const outputFilePatch = path.join(fileDir, `${fileName}[ToH264].mp4`);
                                            ffmpegCommand = `${ffmpegPath} -i "${filePath}" -c:v ${ffmpegEncoding} -c:a aac ${ffmpegExtra} "${outputFilePatch}" -n`;
                                            if (!fs.existsSync(outputFilePatch)) {
                                                try {
                                                    console.log("开始ffmpeg转码: " + ffmpegCommand);
                                                    sendSystemMessage("开始ffmpeg转码: " + fileName);
                                                    await exec(ffmpegCommand);
                                                    console.log("ffmpeg转码完成");
                                                    sendSystemMessage("ffmpeg转码完成");
                                                } catch (error) {
                                                    reject(error);
                                                }
                                            }
                                            const webPath2 = `/a/${animename}/` + `${fileName}[ToH264].mp4`;
                                            const file2 = path.join(animename, `${fileName}[ToH264].mp4`);
                                            db.query(query_insert, [webPath2, file2, `${fileName}[ToH264]`, '1', baseanimename], (err, result) => {
                                                if (err) { reject(err); } else { resolve('ok'); }
                                            });
                                        });
                                        try { await promise; } catch (error) { console.error(error); }
                                    } else {  // 满足条件 直接添加到数据库
                                        const promise = new Promise(async (resolve, reject) => {
                                            db.query(query_insert, [webPath, file, fileName, '1', baseanimename], (err, result) => {
                                                if (err) { reject(err); } else { resolve('ok'); }
                                            });
                                        });
                                        try { await promise; } catch (error) { console.error(error); }
                                    }

                                    // 更新动漫的文件数
                                    const query_update = `
                                        UPDATE animes SET filecount = (
                                            SELECT COUNT(*) FROM files AS f WHERE f.anime_id = animes.id AND f.ok = 1
                                        ) WHERE animes.animename = ?`;
                                    const promise = new Promise((resolve, reject) => {
                                        db.query(query_update, [animename], (err, result) => {
                                            if (err) { reject(err); } else { resolve('ok'); }
                                        });
                                    });
                                    try {
                                        await promise;
                                        successFiles++;
                                        addFiles.push(fileName);
                                    } catch (error) { console.error(error); }
                                } else {
                                    // 文件没有视频流 可能是未下载完成 或者非视频文件
                                    console.log('ffmpeg转码完成 无视频流');
                                }
                            } else {
                                // 抛出预期之外的ffmpeg错误 可能不是视频文件 或者ffmpeg路径错误
                                console.log('ffmpeg转码结束');
                            }
                        }
                    }
                    console.log(`新增${successFiles}个文件: ${addFiles.join(', ')} 更新文件完成`);
                    if (successFiles > 0) { sendSystemMessage(`新增${successFiles}个文件: ${addFiles.join(', ')} 更新文件完成`); }
                    updating = false;
                }
                executeCommands();
            } else {
                console.log('没有新增文件');
                if (typeof callback === 'function') { callback('没有新增文件'); }
                updating = false;
            }
        }
    });
}

// 显示/隐藏ep 手动去掉一些异常ep
app.get('/anime-delfile', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        const id = req.query.id;
        const show = req.query.show || '0';
        const query = `UPDATE files SET ok = ? WHERE id = ?`;
        db.query(query, [show, id], (err, result) => {
            if (err) {
                console.log(err);
                res.json({ state: 'error' });
            } else {
                res.json({ state: 'ok' });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// 更新文件
app.get('/anime-updatefiles', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 9000)) {
        updateFiles((data) => {
            res.json({ state: "ok", msg: data });
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

if (1) {// 创建定时任务
    // 创建规则，每天上午4点更新种子
    const updateRule = new schedule.RecurrenceRule();
    updateRule.hour = 4;
    updateRule.minute = 0;
    schedule.scheduleJob(updateRule, () => {
        console.log('4:00 更新未完结动漫');
        animeUpdateBittorrent(undefined, 10, true, () => {  // 更新种子
            updateNoDownloadBittorrent();  // 添加种子到qbit
        });
    });
    const updateRule_a = new schedule.RecurrenceRule();
    updateRule_a.hour = 12;
    updateRule_a.minute = 0;
    schedule.scheduleJob(updateRule_a, () => {
        console.log('12:00 更新未完结动漫');
        animeUpdateBittorrent(undefined, 10, true, () => {  // 更新种子
            updateNoDownloadBittorrent();  // 添加种子到qbit
        });
    });

    const updateRule_b = new schedule.RecurrenceRule();
    updateRule_b.hour = 20;
    updateRule_b.minute = 0;
    schedule.scheduleJob(updateRule_b, () => {
        console.log('20:00 更新未完结动漫');
        animeUpdateBittorrent(undefined, 10, true, () => {  // 更新种子
            updateNoDownloadBittorrent();  // 添加种子到qbit
        });
    });

    // 更新种子下载进度
    setInterval(() => {
        updateDownliadingBittorrent((data) => {
            console.log(data);
        });
    }, 30 * 60 * 1000);

    // 更新文件列表
    setInterval(() => {
        updateFiles((data) => {
            console.log(data);
        });
    }, 30 * 60 * 1000);
}

// texts 页面路由
app.get('/texts', async (req, res) => {
    if (req.session.loggedin) {
        let textsTheme = undefined;
        const uid = req.session.userid;
        const perm = req.session.perm;
        if (1) {
            const promise = new Promise((resolve, reject) => {
                const query = "SELECT theme FROM texts_texts ORDER BY date DESC LIMIT 1";
                db.query(query, [], (err, results) => {
                    if (err) { reject(err); } else {
                        if (results.length <= 0) {
                            resolve(undefined);
                        } else {
                            resolve(results[0].theme);
                        }
                    }
                });
            });
            try { textsTheme = await promise } catch (error) {
                console.error(error);
            }
        }
        const query = `
            SELECT tt.id, tt.content, tt.used, tt.\`date\`, tt.ok, CASE WHEN tu.user_id IS NOT NULL THEN 1 ELSE 0 END AS \`using\`
            FROM texts_texts AS tt
            LEFT JOIN texts_usertexts tu ON tt.id = tu.texts_id AND tu.user_id = ?
            WHERE tt.theme = ? ${perm >= 8000 ? '' : "AND tt.ok = '1'"} ORDER BY date DESC`;
        db.query(query, [uid, textsTheme ? textsTheme : ''], (err, result) => {
            if (err) { console.error(err); } else {
                res.render('texts', {
                    nickname: req.session.nickname,
                    perm: req.session.perm,
                    theme: textsTheme,
                    data: result
                });
            }
        });
    } else {
        req.session.target = '/texts'
        res.redirect('/login');
    }
});

// texts 记录使用
app.get('/texts-used', (req, res) => {
    if (req.session.loggedin) {
        const uid = req.session.userid;
        const tid = req.query.tid;
        if (!tid) {
            res.json({ state: "error", msg: "参数错误" });
            return
        }
        const query = "INSERT texts_usertexts (texts_id, user_id) VALUES (?, ?)";
        db.query(query, [tid, uid], (err, result) => {
            if (err) { console.error(err); } else {
                const query = `
                    UPDATE texts_texts AS tt 
                    SET tt.used = (SELECT COUNT(*) FROM texts_usertexts AS tu WHERE tu.texts_id = tt.id)
                    WHERE tt.id = ?`
                db.query(query, [tid], (err, result) => {
                    if (err) { console.error(err); } else {
                        res.json({ state: 'ok' })
                    }
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// texts 显示/隐藏
app.get('/texts-show', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 8000)) {
        const tid = req.query.tid;
        const show = req.query.show;
        const query = "UPDATE texts_texts SET ok = ? WHERE id = ?";
        db.query(query, [show, tid], (err, result) => {
            if (err) { console.error(err); } else {
                res.json({ state: 'ok', show: show })
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});

// texts 添加文章
app.post('/texts-add', (req, res) => {
    if (req.session.loggedin && (req.session.perm >= 8000)) {
        const data = req.body;
        const query = "INSERT INTO texts_texts (theme, content) VALUES (?, ?)";
        db.query(query, [data.theme, data.content], (err, result) => {
            if (err) { console.error(err); } else {
                const query = `
                    SELECT tt.id, tt.content, tt.used, tt.\`date\`, tt.ok, CASE WHEN tu.user_id IS NOT NULL THEN 1 ELSE 0 END AS \`using\`
                    FROM texts_texts AS tt
                    LEFT JOIN texts_usertexts tu ON tt.id = tu.texts_id AND tu.user_id = ?
                    WHERE tt.id = ?`;
                db.query(query, [req.session.userid, result.insertId], (err, result) => {
                    if (err) { console.error(err); } else {
                        res.json({ state: 'ok', data: result });
                    }
                });
            }
        });
    } else {
        res.json({ state: "error", msg: "无权限" });
    }
});


// 注册页面路由
app.get('/register', (req, res) => {
    if (req.session.loggedin) {
        res.render('index', { nickname: req.session.nickname });
    } else {
        res.render('register');
    }
});

// 注册处理路由
app.post('/register', (req, res) => {
    const { nickname, username, password } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR nickname = ?';
    db.query(checkQuery, [username, nickname], (err, results) => {
        if (err) { throw err; }
        if (results.length > 0) {
            const user = results[0];
            if (user.username === username) {
                res.redirect('/register?message=' + encodeURIComponent('用户名已存在'));
            } else if (user.nickname === nickname) {
                res.redirect('/register?message=' + encodeURIComponent('昵称已存在'));
            }
        }
        else {
            const sql = 'INSERT INTO users (nickname, username, password, perm) VALUES (?, ?, ?, ?)';
            db.query(sql, [nickname, username, password, defaultUserPerm], (err, result) => {
                if (err) {
                    throw err;
                }
                console.log(`[${getFormattedTimestamp()}][${nickname}]注册成功!`);
                sendSystemMessage(`[${nickname}]注册成功! 欢迎加入nekoneko.site!`);
                req.session.loggedin = true;
                req.session.username = username;
                req.session.nickname = nickname;
                req.session.userid = result.insertId;
                res.redirect('/');
            });
        }
    })
});

// 登录页面路由
app.get('/login', (req, res) => {
    res.render('login');
});

// 登录处理路由
app.post('/login', (req, res) => {
    const { username, password, rememberMe } = req.body;
    req.session.cookie.maxAge = rememberMe ? 180 * 24 * 60 * 60 * 1000 : null;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            const user = results[0];
            req.session.loggedin = true;
            req.session.username = username;
            req.session.nickname = user.nickname;
            req.session.userid = user.id;
            req.session.perm = user.perm;
            res.redirect('/');
            console.log(`[${getFormattedTimestamp()}][${user.nickname}] 登录成功`);
        } else {
            res.redirect('/login?error=账号或密码错误');
            console.log(`[${getFormattedTimestamp()}][${username}] 登录失败`);
        }
    });
});

// 退出登录路由
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            throw err;
        }
        res.redirect('/login');
    });
});


// randomw 路由
app.get('/randompartner', (req, res) => {
    res.render('randomw');
});

// randomw 随机干员路由
app.get('/randompartner-a', (req, res) => {
    const l = req.query.l || 1;
    if (l > 10) {
        res.json({ error: "数量过多" });
    } else {
        const url = `https://prts.wiki/w/%E7%BA%AF%E7%83%AC%E8%89%BE%E9%9B%85%E6%B3%95%E6%8B%89`;
        axios.get(url).then(async (response) => {
            const $ = cheerio.load(response.data);
            const elementlist = randomSample($('.smw-value'), l);
            const promises = [];
            function getData(elements) {
                return new Promise((resolve, reject) => {
                    const element = elements.children[0];
                    const pname = element.attribs.title;
                    const urla = `https://prts.wiki${element.attribs['href']}`;
                    const url = `https://prts.wiki/w/文件:头像_${pname}.png`;
                    axios.get(url).then(async (responseA) => {
                        const $ = cheerio.load(responseA.data);
                        const imgurl = $('#file').children()[0].attribs.href;
                        resolve({
                            state: 'ok',
                            name: pname,
                            url: urla,
                            imgurl: `https://prts.wiki${imgurl}`,
                        });
                    }).catch(error => {
                        reject(error);
                    });
                });
            }
            elementlist.forEach(element => {
                promises.push(getData(element));
            })
            Promise.all(promises).then((data) => {
                res.json(data);
            }).catch((error) => {
                res.json({ error: "无法连接至PRTS" });
            });
        }).catch(error => {
            res.json({ error: "无法连接至PRTS" })
        });
    }
});


// Socket.IO事件处理 用于聊天服务器
io.on('connection', (socket) => {
    const nickname = socket.handshake.session.nickname;
    console.log(`[${getFormattedTimestamp()}][${nickname}] 连接到聊天服务器`);
    onlineCount++; // 有新用户连接时，增加在线人数计数

    // 广播在线人数给所有客户端
    io.emit('onlineCount', onlineCount);

    // 查询最近的最多100条聊天记录
    db.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100', (err, results) => {
        if (err) {
            throw err;
        }

        // 发送最近的聊天记录给新连接的用户
        socket.emit('recentMessages', results.reverse());
    });

    // 接收客户端的ping事件
    socket.on('ping', () => {
        socket.emit('latency'); // 发送latency事件给客户端
    });

    // 接收客户端的聊天消息
    socket.on('chatMessage', ({ message }) => {
        const chatMessage = { nickname, message };

        // 将聊天记录保存到数据库
        db.query('INSERT INTO messages SET ?', chatMessage, (err) => {
            if (err) {
                throw err;
            }
            console.log(`[${getFormattedTimestamp()}][${nickname}] 发送了一条消息: ${message}`);
        });

        // 广播消息给所有连接的客户端
        io.emit('chatMessage', chatMessage);
    });

    socket.on('disconnect', () => {
        console.log(`[${getFormattedTimestamp()}][${nickname}] 断开连接`);
        onlineCount--; // 用户断开连接时，减少在线人数计数

        // 广播在线人数给所有客户端
        io.emit('onlineCount', onlineCount);
    });
});


httpServer.listen(httpPort, () => {
    console.log(`HTTP Server listening on port ${httpPort}`);
});

// 启动服务器
server.listen(port, () => {
    console.log(`HTTPS Server listening on port ${port}`);
});
