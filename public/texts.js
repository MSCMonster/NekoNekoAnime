function countChineseCharacters(str) {
    const pattern = /[\u4e00-\u9fa5]/g; // 匹配中文字符的正则表达式
    const matches = str.match(pattern); // 匹配字符串中的中文字符
    const count = matches ? matches.length : 0; // 中文字符的数量
    return `(字数: ${count})`; // 返回带有中文字数的字符串
}

function showPopup(contenta) {
    $("#content").attr("content", contenta.replace(/(\\n)|(\n)/g, "\n"));
    const content = contenta.replace(/(\\n)|(\n)/g, "<br>");
    const overlay = document.getElementById("overlay");
    const contentDiv = document.getElementById("content");
    const closeBtn = document.getElementById("close");
    contentDiv.innerHTML = content;
    overlay.style.display = "block";
    closeBtn.onclick = function () {
        overlay.style.display = "none";
    };
    overlay.onclick = function (event) {
        if (event.target == overlay) {
            overlay.style.display = "none";
        }
    };
}

function closePopup() {
    const overlay = document.getElementById("overlay");
    overlay.style.display = "none";
}

function copy(text) {
    const el = document.createElement('textarea');
    el.value = text.replace(/\n/g, '\r\n');
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}

$(document).ready(() => {
    $(".open-dialog-btn").each((index, el) => {
        const element = $(el);
        element.on('click', () => {
            $("#content").attr("tid", element.attr("tid"));
            $("#content").attr("using", element.attr("using"));
            if (element.attr("using") == "1") {
                $("#close-btn").prop("disabled", true);
                $("#close-btn").text("使用中");
                $("#submit-btn").prop("disabled", true);
                $("#submit-btn").text("使用中");
                $("#submitcopy-btn").text("复制");
            } else {
                $("#close-btn").prop("disabled", false);
                $("#close-btn").text("取消");
                $("#submit-btn").prop("disabled", false);
                $("#submit-btn").text("使用");
                $("#submitcopy-btn").text("使用并复制");
            }
            showPopup(element.attr("content"));
        });
    });
    $(".submit-btn").each((index, el) => {
        const element = $(el);
        element.on('click', () => {
            const tid = $("#content").attr("tid");
            if ($("#content").attr("using") == "0") {
                $.getJSON(`/texts-used?tid=${tid}`, (data) => {
                    if (data.state == 'ok') {
                        $("#close-btn").prop("disabled", true);
                        $("#close-btn").text("使用中");
                        $("#submit-btn").prop("disabled", true);
                        $("#submit-btn").text("使用中");
                        $("#submitcopy-btn").text("复制");
                        $(`#${$("#content").attr("tid")}`).addClass('mdui-color-blue-200');
                        $(`tr#${$("#content").attr("tid")} > .td-operate > .open-dialog-btn`).attr("using", "1");
                    } else {

                    }
                });
            }
        });
    });
    $("#submitcopy-btn").on("click", () => {
        copy($("#content").attr("content"));
        $("#submitcopy-btn").text("复制成功");
    });
    $(".show-texts-btn").each((index, el) => {
        const element = $(el);
        element.on('click', () => {
            const tid = element.attr("tid")
            const show = element.attr("show") == "1" ? "0" : "1";
            $.getJSON(`/texts-show?tid=${tid}&show=${show}`, (data) => {
                if (data.state == 'ok') {
                    if (data.show == "1") {
                        element.removeClass("mdui-color-green-accent");
                        element.addClass("mdui-color-pink-accent");
                        element.text("隐藏");
                        element.attr("show", "1");
                    } else {
                        element.removeClass("mdui-color-pink-accent");
                        element.addClass("mdui-color-green-accent");
                        element.text("显示");
                        element.attr("show", "0");
                    }
                    const using = element.prev().attr("using") == "1";
                    const ok = data.show == "1";
                    let trColor = '';
                    if (using) {
                        trColor = 'mdui-color-blue-200';
                    }
                    if (!ok) {
                        trColor = 'mdui-color-grey-400';
                    }
                    element.parent().parent().removeClass('mdui-color-blue-200');
                    element.parent().parent().removeClass('mdui-color-grey-400');
                    element.parent().parent().addClass(trColor);
                }
            });
        });
    });
    $("#content-input").keydown((event) => {
        if (event.shiftKey && event.keyCode == 13) {
            // 如果同时按下了 Shift 键和回车键
            event.preventDefault(); // 阻止默认的换行事件
            // 在光标位置添加一个换行符
            const input = $("#content-input")[0];
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            input.value = value.substring(0, start) + "\r\n" + value.substring(end);
            input.selectionStart = input.selectionEnd = start + 1; // 将光标移动到新的行
            mdui.updateTextFields($("#content-input").parent());
        } else if (event.keyCode == 13) {
            event.preventDefault();
            $("#add-progress").removeClass("mdui-invisible");
            const data = { 
                theme: $("#theme-input").val(), 
                content: $("#content-input").val() 
            };
            $.ajax({
                type: 'POST',
                url: '/texts-add',
                data: JSON.stringify(data),
                contentType: 'application/json',
                success: function (response) {
                    $("#add-progress").addClass("mdui-invisible");
                    if (response.state == 'ok') {
                        location.reload();
                    } else {
                        console.error('错误: ', response.msg);
                    }
                },
                error: function (error) {
                    $("#add-progress").addClass("mdui-invisible");
                    console.error('发送请求时出错：', error);
                }
            });
        }
    });
});