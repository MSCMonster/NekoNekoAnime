function clickToCopy(element) {
    const inst = new mdui.Tooltip(element, {content: element.text().trim()});
    if (element.hasClass('click-to-copy')) {
        element.removeClass('click-to-copy');
        element.click(() => {
            const text = element.text().trim();
            // 创建一个临时的textarea元素来容纳要复制的文本内容
            const tempTextarea = $("<textarea>");
            $("body").append(tempTextarea);
            tempTextarea.val(text).select();
            try {
                const successful = document.execCommand("copy");
                mdui.snackbar({ message: successful ? "复制成功" : "复制失败，请手动复制。" });
            } catch (err) {
                mdui.snackbar({ message: `复制失败: ${err}` });
            }
            tempTextarea.remove();
        });
    }
}

function bindClickToCopy() {
    $('.click-to-copy').each((index, element) => { clickToCopy($(element)) });
}

$(document).ready(() => {
    $('#remark').on('input', ()=>{
        $.ajax({
            url: `/w-khlb-bz?id=${$('#remark').attr('remark')}&data=${$('#remark').val()}`,
            method: 'GET',
            success: (data) => {
                if (data.state == 'ok') {  } else { }
            },
            error: (error) => {
                console.log('请求错误：', error);
            }
        });
    });
    bindClickToCopy();
});