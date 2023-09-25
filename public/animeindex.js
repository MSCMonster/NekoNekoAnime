// 定义一个变量来保存当前加载的页数
let currentPageS = 1;
let currentPageR = 1;
let currentPageA = 1;

// 加载更多动漫数据
function loadMoreAnimes(endpoint, litag, btntag, pageC, datalen, queryarg = '') {
    $.ajax({
        url: `${endpoint}?page=${pageC}${queryarg}`,
        method: 'GET',
        success: (data) => {
            // 将获取到的动漫数据添加到页面上
            data.forEach(anime => {
                const formattedDate = formatDate(anime.start_date);
                const animeDiv = $('<li class="mdui-shadow-5"></li>');
                animeDiv.append($(`
                    <a href="/animeplayer?id=${anime.id}" target="_blank">
                        <span class="p-img" style="background-image: url(${anime.coverurl})"></span>
                    </a>
                `));
                animeDiv.append($(`
                <a href="/animeplayer?id=${anime.id}" target="_blank" class="an-info">
                    ${anime.filecount ? '' : '<div class="overlay"></div>'}
                    <div class="an-info-group">
                        <div class="date-text">${formattedDate}</div>
                        <span class="mdui-text-color-black mdui-text-truncate auto-height" 
                            mdui-tooltip="{content:'${anime.animename}${anime.filecount ? '' : ' (无文件)'}',position:'bottom',delay:1}">
                            ${anime.animename}
                        </span>
                    </div> 
                </a>`));
                $(litag).append(animeDiv);
            });
            // 如果返回的数据少于n条，则隐藏“显示更多”按钮
            if (data.length < datalen) {
                $(btntag).hide();
            }
        },
        error: (error) => {
            console.error(error);
        }
    });
}

// 等待页面加载完成后执行loadMoreAnimes()
$(document).ready(() => {
    loadMoreAnimes('/anime-search-r', '#r-play', '#loadMoreBtn-r', currentPageR, 10);
    loadMoreAnimes('/anime-search-all', '#a-play', '#loadMoreBtn-a', currentPageA, 20);
});

// 点击“显示更多”按钮时加载下一页的动漫数据
$('#loadMoreBtn-r').on('click', () => {
    currentPageR++;
    loadMoreAnimes('/anime-search-r', '#r-play', '#loadMoreBtn-r', currentPageR, 10);
});

$('#loadMoreBtn-a').on('click', () => {
    currentPageA++;
    loadMoreAnimes('/anime-search-all', '#a-play', '#loadMoreBtn-a', currentPageA, 20);
});

$('#hide-search').on('click', () => {
    $('#search-box').hide();
});

$('#search-btn').on('click', () => {
    $('#s-play').empty();
    const quertStr = `&searchstr=${document.getElementById('search-input').value}&re=${document.getElementById('re').checked}`;
    loadMoreAnimes('/anime-search-s', '#s-play', '#loadMoreBtn-s', currentPageS, 10, quertStr);
    $('#search-box').show();
})

$('#search-input').on('keyup', function (event) {
    if (event.keyCode === 13) {
        $('#search-btn').click();
    }
})

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}