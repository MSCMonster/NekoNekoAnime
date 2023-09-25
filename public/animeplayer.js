function getAnimeIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

const animeId = getAnimeIdFromURL();
let commentPage = 1;
const player = new Plyr(
    'video',
    // {
    //     captions: {
    //         active: true,
    //         languag: 'auto',
    //         update: true
    //     },
    //     clickToPlay: false,
    //     hideControls: false,
    //     invertTime: false,
    //     volume: 0.5,
    // }
);

$(document).ready(() => {
    player.source = {
        type: 'video',
        sources: [
            {
                src: '/public/placeholder.min.mp4',
                type: 'video/mp4'
            }
        ],
    };
    $.getJSON(`/anime-get-playlog?id=${animeId}`, (data) => {
        if (data.state === 'ok') {
            const playerlogs = new Set(data.data.map(item => item.file_id));
            $.getJSON(`/anime-get-data?id=${animeId}`, (data) => {
                if (data.state === 'ok') {
                    if ($("#reg-input").length > 0 ){
                        $("#reg-input").val(data.data.torrentreg);
                        mdui.updateTextFields($("#reg-input").parent());
                        $("#reg-input").keydown((event) => {
                            if (event.shiftKey && event.keyCode == 13) {
                                // 如果同时按下了 Shift 键和回车键
                                event.preventDefault(); // 阻止默认的换行事件
                                // 在光标位置添加一个换行符
                                const input = $("#reg-input")[0];
                                const start = input.selectionStart;
                                const end = input.selectionEnd;
                                const value = input.value;
                                input.value = value.substring(0, start) + "\r\n" + value.substring(end);
                                input.selectionStart = input.selectionEnd = start + 1; // 将光标移动到新的行
                                mdui.updateTextFields($("#reg-input").parent());
                            } else if (event.keyCode == 13) {
                                event.preventDefault();
                                const re = encodeURIComponent($("#reg-input").val());
                                $.getJSON(`/anime-bindtorrentreg?id=${animeId}&re=${re}`, (data) => {
                                    if (data.state === 'ok') {
                                        mdui.snackbar({
                                            message: `成功! `
                                        });
                                    } else {
                                        mdui.snackbar({ message: `失败` });
                                    }
                                });
                            }
                        });
                    }
                    const animename = data.data.animename;
                    const episodes = data.data.eps.slice().sort((a, b) => a.ep.localeCompare(b.ep));
                    // 更新动漫名称
                    $('#animename').text(animename);
                    $('#web-title').text(animename);
                    // 动态生成每一集的按钮
                    episodes.forEach((episode) => {
                        const fileid = episode.id;
                        const epNumber = episode.ep;
                        const url = episode.path;
                        const subtitle_group = episode.subtitle_group;
                        const ok = episode.ok == '1';
                        const episodeButton = $('<button type="button" class="btn ep-btn">').text(`${epNumber}`);
                        const episodeButtonDwn = $(`<a href="${url}"><button type="button" class="btn ep-btn"></button></a>`);
                        episodeButtonDwn.find("button").text(`${epNumber}`);
                        const episodeButtonDel = $(`<button type="button" class="btn ep-btn${ok ? '' : ' unshow'}"></button>`);
                        episodeButtonDel.on('click', () => {
                            $.getJSON(`/anime-delfile?id=${fileid}${ok ? '' : '&show=1'}`, (data) => {
                                if (data.state == 'ok') {
                                    episodeButtonDel.toggleClass("unshow");
                                }
                            })
                        });
                        episodeButtonDel.text(`${epNumber}`);
                        if (playerlogs.has(fileid)) {
                            episodeButton.addClass('played');
                            episodeButtonDwn.addClass('played');
                        }
                        episodeButton.click(() => {
                            // 提交播放数据
                            $.getJSON(`/animeplaylog?animeid=${animeId}&fileid=${fileid}`, (data) => {
                                if (data.state === 'ok') {
                                    episodeButton.addClass('played');
                                    // 播放对应的视频
                                    player.source = {
                                        type: 'video',
                                        sources: [
                                            {
                                                src: url,
                                                type: 'video/mp4'
                                            }
                                        ],
                                    };
                                    player.play();
                                } else {
                                    console.log(data);
                                }
                            })
                        });
                        // 将按钮添加到页面上
                        if (episode.ok) {
                            $('#episodes').append(episodeButton);
                            $('#episodes-download').append(episodeButtonDwn);
                        }
                        if ($('#episodes-delete').length > 0) {
                            $('#episodes-delete').append(episodeButtonDel);
                        }
                    });
                    $('#episodes').addClass('mdui-panel-item-body');
                    mdui.mutation();
                }
            });
        }
    });
    getAnimeAlias();
    getAnimeComment();
    if ($('#search-torrent-btn').length > 0) {
        $('#search-torrent-btn').on('click', () => {
            $.getJSON(`/anime-searchtorrent?animeid=${animeId}`, (datas) => {
                $("#search-torrent-tbody").empty();
                datas.forEach((data, index) => {
                    const tr = $('<tr>');
                    tr.append($(`<td> ${index + 1} </td>`));
                    tr.append($(`<td> ${data.filename} </td>`));
                    tr.append($(`<td> ${data.state} </td>`));
                    if (data.progress === null) {
                        tr.append($("<td></td>"));
                    } else {
                        tr.append($(`
                            <td>
                                <span class="mdui-center mdui-text-center">${((data.progress) * 100).toFixed(2)} %</span>
                                <div class="mdui-progress" style="max-width: 100px;">
                                    <div class="mdui-progress-determinate" style="width: ${(data.progress) * 100}%;"></div>
                                </div>
                            </td>`));
                    }
                    const addBtn = $(`
                        <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                            <i class="mdui-icon material-icons">add</i>
                        </button></td>
                    `);
                    addBtn.find("button").on('click', () => {
                        addBtn.find("button").prop("disabled", true);
                        $.getJSON(`/anime-addtorrent?xt=${data.xt}`, (data) => {
                            if (data.state === 'ok') {
                                addBtn.html("已添加");
                                mdui.snackbar({ message: `成功!` });
                            } else {
                                addBtn.find("button").prop("disabled", dalse);
                                mdui.snackbar({ message: `失败` });
                            }
                        });
                    });
                    tr.append(addBtn);
                    $("#search-torrent-tbody").append(tr);
                });
            });
        });
    }
});

// 获取别称
function getAnimeAlias() {
    $.getJSON(`/anime-get-alias?id=${animeId}`, (data) => {
        $('#alias').empty();
        data.results.forEach((alias) => {
            // const aliasButton = $('<button type="button" class="btn ep-btn alias-btn"></button>');
            const aliasButton = $(`<div class="mdui-chip mdui-color-blue-100" style="margin:5px"></div>`);
            aliasButton.append(`<span class="mdui-chip-title ">${alias.alias}</span>`);
            if (data.perm) {
                const delAliasBtn = $(`
                    <span class="mdui-chip-delete mdui-color-red">
                        <i class="mdui-icon material-icons">cancel</i>
                    </span>`);
                delAliasBtn.click(() => {
                    $.getJSON(`/anime-rm-alias?id=${animeId}&alias=${alias.alias}`, (data) => {
                        if (data.state == 'ok') {
                            mdui.snackbar({
                                message: `删除别称[${alias.alias}]成功`
                            });
                            getAnimeAlias(animeId);
                        } else {
                            mdui.snackbar({
                                message: `添加别称[${alias.alias}]失败: ${data.error}`, 
                                timeout: 0
                            });
                        }
                    });
                });
                aliasButton.append(delAliasBtn);
            }
            $('#alias').append(aliasButton);
        });
    });
}

// 添加别称
$('#add-alias-btn').on('click', () => {
    const aliasInput = document.getElementById('alias-input');
    const alias = aliasInput.value;
    $.getJSON(`/anime-add-alias?id=${animeId}&alias=${alias}`, (data) => {
        if (data.state == 'ok') {
            // $('#add-alias-result').text(`添加别称[${alias}]成功`);
            // $('#add-alias-result').css('color', 'green');
            mdui.snackbar({
                message: `添加别称[${alias}]成功`
            });
            getAnimeAlias(animeId);
        } else {
            // $('#add-alias-result').text(`添加别称[${alias}]失败: ${data.error}`);
            // $('#add-alias-result').css('color', 'red');
            mdui.snackbar({
                message: `添加别称[${alias}]失败: ${data.error}`
            });
        }
    });
});

// 更新全部别称
$('#update-alias-btn').on('click', () => {
    $('#update-alias-btn').removeClass('mdui-color-blue-100');
    $('#update-alias-btn').prop('disabled', true);
    $('#update-alias-btn').empty();
    $('#update-alias-btn').append('<div class="mdui-spinner"></div>');
    mdui.mutation();
    $.getJSON(`/anime-update-alias?id=${animeId}`, (data) => {
        $('#update-alias-btn').empty();
        $('#update-alias-btn').prop('disabled', false);
        $('#update-alias-btn').addClass('mdui-color-blue-100');
        $('#update-alias-btn').append('<i class="mdui-icon material-icons">&#xe5d5;</i>');
        if (data.state == 'ok') {
            mdui.snackbar({
                message: `更新别称成功 ${data.message}`
            });
            getAnimeAlias(animeId);
        } else {
            mdui.snackbar({
                message: `更新别称失败: ${data.message}`
            });
        }
    });
});

// 获取评论
function getAnimeComment() {
    $.getJSON(`/anime-get-comment?id=${animeId}&page=${commentPage}`, (data) => {
        let comment_w = 0;
        data.forEach((comment) => {
            const textBox = $('<div class="text_main_even"></div>');
            const commentBox = $('<div class="comment-box mdui-shadow-1"></div>');
            if (comment_w % 2 == 0) {
                textBox.addClass('text-left');
            } else {
                textBox.addClass('text-right');
            }
            commentBox.append(`<a class="l">${comment.nickname}</a>`);
            commentBox.append(`<small class="gery">@${new Date(comment.date).toLocaleString()}</small>`);
            if (comment.can_del) {
                const delBtn = $(`
                    <button class="delete-button" type="button">
                    <i class="mdui-icon material-icons" style="font-size: 19px;">&#xe872;</i>
                    </button>`);
                delBtn.on('click', () => {
                    $.getJSON(`/anime-rm-comment?commentid=${comment.id}`, (data) => {
                        if (data.state == 'ok') {
                            mdui.snackbar({
                                message: `删除吐槽成功`
                            });
                            commentBox.addClass('deleted');
                            setTimeout(() => { textBox.addClass('deleted'); }, 500);
                        } else {
                            mdui.snackbar({
                                message: `删除吐槽失败: ${data.error}`
                            });
                        }
                    })
                })
                commentBox.append(delBtn);
            }
            commentBox.append(`<p class="comment-content">${comment.comment}</p>`);
            textBox.append(commentBox);
            $('#comments').append(textBox);
            comment_w++;
        });
    });
}

// 添加评论
$('#add-comment-btn').on('click', () => {
    const commentInput = document.getElementById('comment-input');
    const comment = commentInput.value;
    const jsonData = { comment: comment, animeid: animeId };
    $.ajax({
        url: '/anime-add-comment',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(jsonData),
        success: (data) => {
            if (data.state == 'ok') {
                mdui.snackbar({
                    message: `发表吐槽成功`
                });
                $('#comments').empty();
                commentInput.value = '';
                getAnimeComment(animeId);
            } else {
                mdui.snackbar({
                    message: `发表吐槽失败: ${data.error}`
                });
            }
        },
        error: (error) => {
            console.log('请求错误：', error);
        }
    });
})




