// 格式化时间
function formatDate(date) {
    if (date) {
        const maxDate = new Date(date);
        const formattedDate = `${maxDate.getFullYear()}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${String(maxDate.getDate()).padStart(2, '0')} ${String(maxDate.getHours()).padStart(2, '0')}:${String(maxDate.getMinutes()).padStart(2, '0')}:${String(maxDate.getSeconds()).padStart(2, '0')}`;
        return formattedDate;
    } else {
        return NaN
    }
}

$(document).ready(() => {
    $("#search-anime-input").keydown((event) => {
        if (event.keyCode == 13) {
            $("#update-prog").removeClass("mdui-invisible");
            const str = $("#search-anime-input").val();
            $.getJSON(`/anime-mk-search?str=${str}`, (datas) => {
                if (typeof (datas) == 'object') {
                    $("#search-anime-tbody").empty();
                    datas.forEach((data, index) => {
                        const tr = $(`<tr>`);
                        tr.append($(`<td>${index + 1}</td>`));
                        tr.append($(`<td>${data.animename}</td>`));
                        tr.append($(`<td>${data.mkid}</td>`));
                        if (data.inDb) {
                            tr.append($(`<td>已添加</td>`));
                        } else {
                            const addBtn = $(`
                                <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                                    <i class="mdui-icon material-icons">add</i>
                                </button></td>
                            `);
                            addBtn.find("button").on('click', () => {
                                addBtn.find("button").prop("disabled", true);
                                $.getJSON(`/anime-mk-add?mkid=${data.mkid}`, (data) => {
                                    if (data.state === 'ok') {
                                        addBtn.html("已添加");
                                        mdui.snackbar({ message: `添加动漫: ${data.anime.animename} 成功!` });
                                    } else {
                                        addBtn.find("button").prop("disabled", dalse);
                                        mdui.snackbar({ message: `失败` });
                                    }
                                });
                            });
                            tr.append(addBtn);
                        }
                        $("#search-anime-tbody").append(tr);
                    });
                } else {
                    mdui.snackbar({ message: `失败` });
                }
                $("#update-prog").addClass("mdui-invisible");
            });
        }
    });
    $("#bind-stg-btn").on('click', () => {
        $("#update-prog").removeClass("mdui-invisible");
        $.getJSON(`/anime-nobindstg`, (datas) => {
            if (typeof (datas) == 'object') {
                $("#bind-stg-body").empty();
                datas.forEach((data, index) => {
                    const mkid = data.mkid;
                    const tr = $(`<tr>`);
                    tr.append($(`<td>${index + 1}</td>`));
                    tr.append($(`<td>${data.animename}</td>`));
                    tr.append($(`<td>${mkid}</td>`));
                    const addBtn = $(`
                        <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                            <i class="mdui-icon material-icons">visibility</i>
                        </button></td>
                    `);
                    addBtn.find("button").on('click', () => {
                        $("#update-prog").removeClass("mdui-invisible");
                        $.getJSON(`/anime-getstg?mkid=${data.mkid}`, (datas) => {
                            $("#update-prog").addClass("mdui-invisible");
                            if (typeof (datas) == 'object') {
                                $("#anime-stg-div").removeClass("mdui-hidden");
                                window.location.hash = "anime-stg-div";
                                // $("html, body").animate({
                                //     scrollTop: $("#anime-stg-div").offset().top
                                // }, 300);
                                datas.forEach((data) => {
                                    const stgid = data.id;
                                    const tr = $(`<tr class="anime-stg-tr" id="anime-stg-tr-${stgid}">`);
                                    tr.append($(`<td>${stgid}</td>`));
                                    tr.append($(`<td>${data.name}</td>`));
                                    tr.append($(`
                                        <td><ul class="mdui-list">
                                            ${data.files.map((file) => { return '<p class="tr-p">' + file + "</p>" }).join("\n")}
                                        </ul></td>`));
                                    const addBtn = $(`
                                        <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                                            <i class="mdui-icon material-icons">lock</i>
                                        </button></td>
                                    `);
                                    addBtn.find("button").on('click', () => {
                                        $("#update-prog").removeClass("mdui-invisible");
                                        $.getJSON(`/anime-bindstg?mkid=${mkid}&stgid=${stgid}`, (data) => {
                                            $("#update-prog").addClass("mdui-invisible");
                                            if (data.state == 'ok') {
                                                mdui.snackbar({ message: `成功` });
                                                $(".anime-stg-tr").each((index, element) => {
                                                    $(element).addClass("mdui-hidden");
                                                });
                                                tr.removeClass("mdui-hidden");
                                                addBtn.find("button").prop("disabled", true);
                                                window.location.hash = `anime-stg-tr-${stgid}`;
                                                // $("html, body").animate({
                                                //     scrollTop: tr.offset().top
                                                // }, 300);
                                            } else {
                                                mdui.snackbar({ message: `失败` });
                                            }
                                        });
                                    });
                                    tr.append(addBtn);
                                    $("#anime-stg-body").append(tr);
                                });
                            } else {
                                mdui.snackbar({ message: `失败` });
                            }
                        });
                    });

                    const rmBtn = $(`
                    <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                        <i class="mdui-icon material-icons">delete_forever</i>
                    </button></td>
                    `);
                    rmBtn.find("button").on('click', () => {
                        $("#update-prog").removeClass("mdui-invisible");
                        $.getJSON(`/anime-mk-rm?id=${data.id}`, (data) => {
                            $("#update-prog").addClass("mdui-invisible");
                            if (data.state == 'ok') {
                                mdui.snackbar({ message: `删除成功` });
                                tr.removeClass("mdui-hidden");
                                rmBtn.find("button").prop("disabled", true);
                            } else {
                                mdui.snackbar({ message: `删除失败` });
                            }
                        });
                    });
                    tr.append(addBtn);
                    tr.append(rmBtn);
                    $("#bind-stg-body").append(tr);
                });
            } else {
                mdui.snackbar({ message: `失败` });
            }
            $("#update-prog").addClass("mdui-invisible");
        });
    });
    $("#bind-bre-btn").on('click', () => {
        $("#update-prog").removeClass("mdui-invisible");
        $.getJSON(`/anime-nobindbre`, (datas) => {
            if (typeof (datas) == 'object') {
                $("#search-bre-tbody").empty();
                datas.forEach((data, index) => {
                    const animeid = data.id;
                    const tr = $(`<tr>`);
                    tr.append($(`<td>${index + 1}</td>`));
                    tr.append($(`<td>${data.animename}</td>`));
                    const reInput = $(`<textarea class="mdui-textfield-input" type="text" placeholder="正则">${data.files.replace(/[\/.*+?^${}()|[\]\\]/g, '\\$&')}</textarea>`);
                    const reTr = $(`<td><div class="mdui-textfield"></div></td>`);
                    reTr.find('div').append(reInput);
                    tr.append(reTr);
                    const addBtn = $(`
                        <td><button class="mdui-btn mdui-btn-icon mdui-btn-raised mdui-ripple mdui-color-blue-200">
                            <i class="mdui-icon material-icons">file_upload</i>
                        </button></td>
                    `);
                    addBtn.find("button").on('click', () => {
                        const re = encodeURIComponent(reInput.val());
                        $.getJSON(`/anime-bindtorrentreg?id=${animeid}&re=${re}`, (data) => {
                            if (data.state === 'ok') {
                                mdui.snackbar({
                                    message: `成功! 开始更新种子`,
                                    timeout: 500,
                                });
                                $.getJSON(`/anime-updatebittorrent?animeid=${animeid}&take=100`, (data) => {
                                    if (data.state === 'ok') {
                                        mdui.snackbar({ message: `成功! ${data.msg}` });
                                    } else {
                                        mdui.snackbar({ message: `失败! ${data.msg}` });
                                    }
                                });
                            } else {
                                mdui.snackbar({ message: `失败` });
                            }
                        });
                    });
                    tr.append(addBtn);
                    $("#search-bre-tbody").append(tr);
                });
            } else {
                mdui.snackbar({ message: `失败` });
            }
            $("#update-prog").addClass("mdui-invisible");
        });
    });
    $("#update-animetor-input").keydown((event) => {
        if (event.keyCode == 13) {
            const animeid = $("#update-animetor-input").val();
            $.getJSON(`/anime-updatebittorrent?animeid=${animeid}&take=100`, (data) => {
                if (data.state === 'ok') {
                    mdui.snackbar({ message: `成功! ${data.msg}` });
                } else {
                    mdui.snackbar({ message: `失败! ${data.msg}` });
                }
                $("#update-prog").addClass("mdui-invisible");
            });
        }
    });
    $("#start-dwn-btn").on('click', () => {
        $("#update-prog").removeClass("mdui-invisible");
        $.getJSON(`/anime-downloadbittorrent`, (data) => {
            if (data.state === 'ok') {
                mdui.snackbar({ message: `成功! 开始下载${data.msg.length}个种子` });
            } else {
                mdui.snackbar({ message: `失败! ${data.msg}` });
            }
            $("#update-prog").addClass("mdui-invisible");
        });
    });
    $("#update-tor-btn").on('click', () => {
        $("#update-prog").removeClass("mdui-invisible");
        $.getJSON(`/anime-updatedownloadingbittorrent`, (data) => {
            if (data.state === 'ok') {
                mdui.snackbar({ message: `成功! ${data.msg}` });
            } else {
                mdui.snackbar({ message: `失败! ${data.msg}` });
            }
            $("#update-prog").addClass("mdui-invisible");
        });
    });
    $("#update-file-btn").on('click', () => {
        $("#update-prog").removeClass("mdui-invisible");
        $.getJSON(`/anime-updatefiles`, (data) => {
            if (data.state === 'ok') {
                mdui.snackbar({ message: `成功! ${data.msg}` });
            } else {
                mdui.snackbar({ message: `失败! ${data.msg}` });
            }
            $("#update-prog").addClass("mdui-invisible");
        });
    });
});