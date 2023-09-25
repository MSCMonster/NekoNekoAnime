$(document).ready(function () {
    // 当选择了文件后，显示预览图
    $("#imageInput").change(function () {
        readURL(this);
    });

    // 点击"Upload Image"按钮时，执行POST提交
    $("#uploadButton").click(function () {
        uploadImage();
    });
});

// 读取选择的图片并显示预览
function readURL(input) {
    if (input.files && input.files[0]) {
        const maxSizeInBytes = 5 * 1024 * 1024;
        if (input.files[0].size > maxSizeInBytes) {
            mdui.snackbar({
                message: '图片不能大于5MB'
            });
        } else {
            var reader = new FileReader();

            reader.onload = function (e) {
                const dataURL = reader.result;
                $("#previewImage").attr("src", e.target.result);
                $("#previewImage").show();
                const img = new Image();
                img.onload = function () {
                    const width = img.width;
                    const height = img.height;
                    $("#previewImage").attr("data-width", width);
                    $("#previewImage").attr("data-height", height);
                };
                img.src = dataURL;
            };
            const fileName = input.files[0].name;
            $("#previewImage").attr("filename", fileName);

            reader.readAsDataURL(input.files[0]);
        }
    }
}

// 将图片转换为Base64编码并进行POST提交
function uploadImage() {
    const fileInput = document.getElementById("imageInput");
    const imgWidth = document.getElementById('img-width').value;
    var formData = new FormData();
    formData.append("image", fileInput.files[0]);
    formData.append("sw", imgWidth);
    formData.append("width", $("#previewImage").attr("data-width"));
    formData.append("height", $("#previewImage").attr("data-height"));

    const imageData = $("#previewImage").attr("src");
    if (!imageData) {
        mdui.snackbar({
            message: '未选择图片'
        });
    } else {
        $('#progress').removeClass('mdui-hidden');
        $.ajax({
            url: '/imgascii',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (data) => {
                if (data.state == 'ok') {
                    $('#progress').addClass('mdui-hidden');
                    mdui.snackbar({
                        message: `成功`
                    });
                    $('#content').empty();
                    const fontSize = Math.floor(1400 / data.data.split("\n")[0].length);
                    data.data.split("\n").forEach(element => {
                        const line = $(`<div style="font-size:${fontSize}px !important;">${element}</div>`);
                        // element.split('').forEach(e=>{
                        //     line.append($(`<div>${e}</div>`));
                        // });
                        $('#content').append(line);
                    });
                    // $('#content').text(data.data.replace(/\n/g, "<br>"));
                } else {
                    mdui.snackbar({
                        message: `失败: ${data.message}`
                    });
                }
            },
            error: (error) => {
                console.log('请求错误：', error);
            }
        });
    }
}
