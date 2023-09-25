let tabSelect;
function clickToCopy(element) {
    if (element.hasClass('click-to-copy')) {
        element.removeClass('click-to-copy');
        element.click(() => {
            const text = element.text();
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

function bindTab() {
    document.querySelectorAll('.tab-link').forEach((link) => {
        if (!$(link).hasClass('bind-tab')) {
            $(link).addClass('bind-tab');
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const targetTabId = link.getAttribute('tab');
                const tabContents = document.querySelectorAll('.tab');
                tabContents.forEach((content) => {
                    content.style.display = 'none';
                });
                const targetTabContent = document.querySelector(`#${targetTabId}`);
                if (targetTabContent) {
                    targetTabContent.style.display = 'block';
                }
            });
        }
    });
}

let khlbPage = 1
let kholdString;
function getKhlb() {
    let queryString = `page=${khlbPage}&`;
    $('#khlb').find('.kh-input').each((index, element) => {
        const name = $(element).attr('name');
        const value = $(element).val();
        queryString += (index === 0 ? '' : '&') + name + '=' + value;
    });
    if (kholdString == queryString) { return }
    kholdString = queryString;
    $.getJSON(`/w-khlb?${queryString}`, (datas) => {
        if (datas.count) {
            const maxPage = Math.floor(datas.count / datas.limit) + 1
            const pages = [
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">1</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${khlbPage - 1}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised" disabled>${khlbPage}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${khlbPage + 1}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${maxPage}</button>`),
            ];
            pages.forEach(btn => {
                btn.click(() => {
                    khlbPage = parseInt(btn.text());
                    getKhlb();
                });
            })
            $('#khlb-page-btn').empty();
            const pageInput = $(`<div class="mdui-textfield mdui-textfield-floating-label"></div>`);
            const pageInputa = $(`<input class="mdui-textfield-input" name="page" placeholder="1" value=${khlbPage} type="number"/>`);
            pageInputa.on('keydown', (event) => {
                if (event.keyCode === 13 && Number(pageInputa.val())) {
                    khlbPage = Number(pageInputa.val());
                    getKhlb();
                }
            });
            pageInput.append(pageInputa);
            $('#khlb-page-btn').append(pageInput);
            if (khlbPage > 1) { $('#khlb-page-btn').append(pages[0]); }
            if (khlbPage > 2) { $('#khlb-page-btn').append(pages[1]); }
            $('#khlb-page-btn').append(pages[2]);
            if (khlbPage < maxPage - 1) { $('#khlb-page-btn').append(pages[3]); }
            if (khlbPage < maxPage) { $('#khlb-page-btn').append(pages[4]); }
            mdui.mutation();
        }
        if (datas.data) {
            $('#khlb-tbody').empty();
            datas.data.forEach((data, index) => {
                const tr = $('<tr></tr>');
                tr.append($(`<td class="mdui-text-truncate" mdui-tooltip="{content: '点击查看详情'}"><a href="/wu?id=${data.id}" target="_blank">${index + 1}</a></td>`));
                tr.append($(`<td  style="display: none;" class="mdui-text-truncate click-to-copy td-userid" mdui-tooltip="{content: '${data.客户记录编号}'}">${data.客户记录编号}</td>`));
                tr.append($(`<td class="mdui-text-truncate click-to-copy td-name" mdui-tooltip="{content: '${data.姓名}'}">${data.姓名}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-gender">${data.性别}</td>`));
                tr.append($(`<td class="mdui-text-truncate click-to-copy td-idnumber" mdui-tooltip="{content: '${data.证件号码}'}">${data.证件号码}</td>`));
                if (data.电话 && data.电话 != 'null' && data.电话 != 'None') {
                    const 电话 = data.电话.replace(/\s+/g, " ");
                    tr.append($(`<td class="mdui-text-truncate click-to-copy td-phonenumber" mdui-tooltip="{content: '${电话}'}">${电话}</td>`));
                }
                else { tr.append($(`<td></td>`)); }
                if (data.地址 && data.地址 != 'null' && data.地址 != 'None') {
                    tr.append($(`<td class="mdui-text-truncate click-to-copy td-address" mdui-tooltip="{content: '${data.地址}'}">${data.地址}</td>`));
                }
                else { tr.append($(`<td></td>`)); }
                const bzrd = $(`<td class="mdui-text-truncate td-cell"><div class="mdui-textfield mdui-text-truncate td-cell"></div></td>`);
                const bz = $(`<input class="mdui-textfield-input td-cell" type="text" placeholder="备注" value="${data.备注}"/>`);
                let bzv = bz.val();
                bz.on('input', () => {
                    if (bzv != bz.val()) {
                        bzv = bz.val();
                        $.ajax({
                            url: `/w-khlb-bz?id=${data.id}&data=${bz.val()}`,
                            method: 'GET',
                            success: (data) => {
                                if (data.state == 'ok') {
                                } else { }
                            },
                            error: (error) => {
                                console.log('请求错误：', error);
                            }
                        });
                    }
                });
                bzrd.find('div').append(bz);
                tr.append(bzrd);
                $('#khlb-tbody').append(tr);
                bindClickToCopy();
            });
        }
    });
}

let xzOrder = '';
let bdlbPage = 1;
let bdoldString = '';
function getBdlb() {
    let queryString = `page=${bdlbPage}&order=${xzOrder}&`;
    $('#bdlb > div > table > thead > tr').find('.bd-input').each((index, element) => {
        const name = $(element).attr('name');
        let value = $(element).val();
        if ($(element).hasClass('num')) {
            if (!value) { value = 0; }
            const operator = $(element).parent().prev().attr('operator');
            value = `${operator} ${value}`;
        }
        queryString += (index === 0 ? '' : '&') + name + '=' + value;
    });
    if (bdoldString == queryString) { return }
    bdoldString = queryString;
    $.getJSON(`/w-bdlb?${queryString}`, (datas) => {
        if (datas.count) {
            const maxPage = Math.floor(datas.count / datas.limit) + 1
            const pages = [
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">1</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${bdlbPage - 1}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised" disabled>${bdlbPage}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${bdlbPage + 1}</button>`),
                $(`<button class="page-btn mdui-btn mdui-btn-icon mdui-btn-dense mdui-color-red mdui-ripple mdui-btn-raised">${maxPage}</button>`),
            ];
            pages.forEach(btn => {
                btn.click(() => {
                    bdlbPage = parseInt(btn.text());
                    getBdlb();
                });
            })
            $('#bdlb-page-btn').empty();
            const pageInput = $(`<div class="mdui-textfield mdui-textfield-floating-label"></div>`);
            const pageInputa = $(`<input class="mdui-textfield-input" name="page" placeholder="1" value=${bdlbPage} type="number"/>`);
            pageInputa.on('keydown', (event) => {
                if (event.keyCode === 13 && Number(pageInputa.val())) {
                    bdlbPage = Number(pageInputa.val());
                    getBdlb();
                }
            });
            pageInput.append(pageInputa);
            $('#bdlb-page-btn').append(pageInput);
            if (bdlbPage > 1) { $('#bdlb-page-btn').append(pages[0]); }
            if (bdlbPage > 2) { $('#bdlb-page-btn').append(pages[1]); }
            $('#bdlb-page-btn').append(pages[2]);
            if (bdlbPage < maxPage - 1) { $('#bdlb-page-btn').append(pages[3]); }
            if (bdlbPage < maxPage) { $('#bdlb-page-btn').append(pages[4]); }
            mdui.mutation();
        }
        if (datas.data) {
            $('#bdlb-tbody').empty();
            datas.data.forEach((data, index) => {
                const tr = $('<tr></tr>');
                tr.append($(`<td class="mdui-text-truncate" mdui-tooltip="{content: '点击查看详情'}"><a href="/wb?id=${data.id}" target="_blank">${index + 1}</a></td>`));
                tr.append($(`<td class="mdui-text-truncate td-userid" mdui-tooltip="{content: '${data.保单号}'}">${data.保单号}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '点击查看详情'}"><a href="/wu?id=${data.tid}" target="_blank">${data.保单投保人}</a></td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '点击查看详情'}"><a href="/wu?id=${data.bkid}" target="_blank">${data.保单被保险人}</a></td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '${data.保单销售人员}'}">${data.保单销售人员}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '${data.保单服务人员}'}">${data.保单服务人员}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '${data.转保标识}'}">${data.转保标识}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-type" mdui-tooltip="{content: '${data.保单状态}'}">${data.保单状态}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-userid" mdui-tooltip="{content: '${data.账户余额}'}">${data.账户余额}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-idnumber" mdui-tooltip="{content: '${data.责任组名称}'}">${data.责任组名称}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-userid" mdui-tooltip="{content: '${data.标准保费}'}">${data.标准保费}</td>`));
                tr.append($(`<td class="mdui-text-truncate td-name" mdui-tooltip="{content: '${data.交费期间}'}">${data.交费期间}</td>`));
                const bzrd = $(`<td class="mdui-text-truncate td-cell"><div class="mdui-textfield mdui-text-truncate td-cell"></div></td>`);
                const bz = $(`<input class="mdui-textfield-input td-cell" type="text" placeholder="备注" value="${data.备注}"/>`);
                let bzv = bz.val();
                bz.on('input', () => {
                    if (bzv != bz.val()) {
                        bzv = bz.val();
                        $.ajax({
                            url: `/w-bdlb-bz?id=${data.id}&data=${bz.val()}`,
                            method: 'GET',
                            success: (data) => {
                                if (data.state == 'ok') {
                                } else { }
                            },
                            error: (error) => {
                                console.log('请求错误：', error);
                            }
                        });
                    }
                });
                bzrd.find('div').append(bz);
                tr.append(bzrd);
                $('#bdlb-tbody').append(tr);
            });
        }
    });
}

// function addUserDataPage(uid) {
//     // TODO: 先查询再显示
//     const tabLink = $(`<a class="mdui-ripple mdui-ripple-white tab-link">${data.姓名}</a>`)
//     const closeBtn = $('<button class="mdui-btn mdui-btn-icon mdui-btn-dense"><i class="mdui-icon material-icons">close</i></button>');
//     closeBtn.on('click', ()=>{
//         tabSelect.show(0);
//         tabLink.remove();
//         // TODO: 移除对应版块
//         $('#khlb').show();
//     });
//     tabLink.append(closeBtn);
//     $('#tab').append(tabLink);
//     tabSelect.handleUpdate();
//     tabSelect.show($('#tab').find('a').length - 1);
//     tabLink.trigger('click');
//     bindTab();
//     const tabContents = document.querySelectorAll('.tab');
//     tabContents.forEach((content) => {
//         content.style.display = 'none';
//     });
// }


$(document).ready(() => {
    tabSelect = new mdui.Tab($('#tab'), { trigger: 'click' });
    bindTab()
    // 按钮组只有一个被选中
    $('.mdui-btn-group > .mdui-btn').each((index, element) => {
        $(element).on('click', () => {
            $(element).siblings().removeClass('mdui-btn-active');
            $(element).addClass('mdui-btn-active');
        });
    });
    // 只有一种排序方法
    $('.order-btn').each((index, element) => {
        $(element).on('click', () => {
            $('.order-btn').each((index, e) => {
                $(e).removeClass('mdui-btn-active');
            });
            $(element).addClass('mdui-btn-active');
            xzOrder = $(element).attr('name');
            console.log(xzOrder);
        });
    });
    // 切换运算符
    $('.operator-btn').each((index, element) => {
        $(element).on('click', () => {
            const operator = $(element).attr('name');
            $(element).parent().attr('operator', operator);
        });
    });

    // 切换到客户信息页面时刷新客户信息搜索结果
    $('#tab-khlb').on('click', () => { if (!$('#tab-khlb').hasClass('empty')) { $('#tab-khlb').removeClass('empty'); getKhlb(); } });
    $('#tab-bdlb').on('click', () => { if (!$('#tab-bdlb').hasClass('empty')) { $('#tab-bdlb').removeClass('empty'); getBdlb(); } });

    // 改编客户搜索条件时刷新搜索结果
    $('.kh-input').each((index, element) => { $(element).on('input', () => { khlbPage = 1; getKhlb(); }); });
    $('.bd-input').each((index, element) => { $(element).on('input', () => { bdlbPage = 1; getBdlb(); }); });
    // $('.order-btn').each((index, element) => { $(element).on('click', () => { bdlbPage = 1; getBdlb(); }); });
    $('.th-btn').each((index, element) => { $(element).on('click', () => { bdlbPage = 1; getBdlb(); }); });

    // 切换到客户信息页面
    $('#tab-khlb').trigger('click');

    // 点击复制事件
    bindClickToCopy();
});