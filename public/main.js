const socket = io();
const onlineCountElement = document.getElementById('online-count');
const chatLog = document.getElementById('chat-log');
const messageInput = document.getElementById('message');
const sendButton = document.getElementById('send-btn');
const latencyElement = document.getElementById('latency');
let latencyStart;  // 计算延迟
let shouldScrollToBottom = true; // 是否自动滚动到底部

// 判断是否滚动到底部
chatLog.addEventListener('scroll', () => {
    shouldScrollToBottom = chatLog.scrollTop + chatLog.clientHeight === chatLog.scrollHeight;
});

// 发送消息
sendButton.addEventListener('click', () => {
    const message = messageInput.value.replace(/\n/g, '<br>');
    socket.emit('chatMessage', { message });
    messageInput.value = '';
});

// 接收消息
socket.on('chatMessage', ({ nickname, message }) => {
    const newMessage = document.createElement('div');
    newMessage.innerHTML = `<strong>${nickname}</strong>: ${message}`;
    chatLog.appendChild(newMessage);
    // 如果当前已经在消息末尾，才滚动到底部
    if (shouldScrollToBottom) {
        chatLog.scrollTop = chatLog.scrollHeight;
    }
});

// 重新连接的时候清空消息
socket.on('recentMessages', (messages) => {
    chatLog.innerHTML = ``;
    messages.forEach(({ nickname, message }) => {
        const chatMessage = document.createElement('div');
        chatMessage.innerHTML = `<strong>${nickname}</strong>: ${message}`;
        chatLog.appendChild(chatMessage);
        chatLog.scrollTop = chatLog.scrollHeight;
    });
});

// 接收人数变更事件
socket.on('onlineCount', (count) => {
    onlineCountElement.textContent = `当前在线: ${count} 人`;
});

// 接收服务器的latency事件
socket.on('latency', () => {
    const latency = Date.now() - latencyStart; // 计算延迟时间
    latencyElement.textContent = `延迟: ${latency} ms`;
});

// 客户端每秒测量一次延迟
setInterval(() => {
    socket.emit('ping'); // 向服务器发送ping事件
    latencyStart = Date.now(); // 记录开始时间
}, 1000);

document.addEventListener("DOMContentLoaded", function () {
    var messageInput = document.getElementById("message");
    messageInput.addEventListener("keydown", function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            document.getElementById("send-btn").click();
        } else if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault(); // 阻止默认的换行行为
            const { selectionStart, selectionEnd, value } = messageInput;
            const newValue = `${value.substring(0, selectionStart)}\n${value.substring(selectionEnd)}`;
            messageInput.value = newValue;
            messageInput.selectionStart = messageInput.selectionEnd = selectionStart + 1;
        }
    });
});