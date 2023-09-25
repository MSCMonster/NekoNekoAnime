$(document).ready(() => {
    $('#r-btn').on('click', () => {
        $('#progress').removeClass('mdui-hidden');
        const l = document.getElementById('l').value;
        $.getJSON(`/randompartner-a?l=${l}`, (data) => {
            if (data.error) {
                mdui.snackbar({
                    message: data.error,
                    timeout: 0
                });
            } else {
                $('#ul').empty();
                data.forEach((element, index) => {
                    const li = $(`
                        <a href='${element.url}'}><li class="mdui-list-item mdui-ripple">
                            <div class="mdui-list-item-avatar">
                                <img src="${element.imgurl}"/>
                            </div>
                            <div class="mdui-list-item-content">${index + 1}. ${element.name}</div>
                        </li></a>`);
                    new mdui.Tooltip(li, {content: `点击跳转到PRTS ${element.name} 页面`});
                    $('#ul').append(li);
                });
            }
            $('#progress').addClass('mdui-hidden');
        });
    });
    $('#l').on('change', ()=>{
        const l = document.getElementById('l').value;
        $('#r-btn').text(`随机${l}个!`);
    });
});


