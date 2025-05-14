// 在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const bookmarkFolders = document.getElementById('bookmark-folders');
    const bookmarkList = document.getElementById('bookmark-list');
    
    // 当前选中的文件夹ID
    let currentFolderId = '1'; // 默认为书签栏
    
    // 初始化加载书签
    loadBookmarks();
    
    // 搜索按钮点击事件
    searchButton.addEventListener('click', function() {
        searchBookmarks(searchInput.value);
    });
    
    // 搜索输入框回车事件
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBookmarks(searchInput.value);
        }
    });
    
    // 加载书签树和当前文件夹的书签
    function loadBookmarks() {
        // 获取书签树
        chrome.bookmarks.getTree(function(results) {
            // 清空文件夹树
            bookmarkFolders.innerHTML = '';
            
            // 渲染书签树
            renderBookmarkTree(results[0].children, bookmarkFolders);
            
            // 加载默认文件夹的书签
            loadBookmarksInFolder(currentFolderId);
        });
    }
    
    // 渲染书签树
    function renderBookmarkTree(bookmarkNodes, container) {
        bookmarkNodes.forEach(function(node) {
            // 创建树节点
            const treeItem = document.createElement('div');
            treeItem.className = 'tree-item';
            treeItem.textContent = node.title || '未命名';
            
            // 如果是文件夹
            if (node.children) {
                treeItem.classList.add('folder');
                treeItem.dataset.id = node.id;
                
                // 点击文件夹切换展开/折叠状态
                treeItem.addEventListener('click', function(e) {
                    e.stopPropagation();
                    
                    // 切换子节点的显示状态
                    const childrenContainer = this.nextElementSibling;
                    if (childrenContainer) {
                        childrenContainer.classList.toggle('open');
                        this.classList.toggle('open');
                    }
                    
                    // 加载该文件夹的书签
                    currentFolderId = node.id;
                    loadBookmarksInFolder(currentFolderId);
                });
                
                // 添加到容器
                container.appendChild(treeItem);
                
                // 创建子节点容器
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                container.appendChild(childrenContainer);
                
                // 递归渲染子节点
                if (node.children.length > 0) {
                    renderBookmarkTree(node.children, childrenContainer);
                }
            }
        });
    }
    
    // 加载指定文件夹中的书签
    function loadBookmarksInFolder(folderId) {
        chrome.bookmarks.getChildren(folderId, function(bookmarks) {
            renderBookmarkList(bookmarks);
        });
    }
    
    // 渲染书签列表
    function renderBookmarkList(bookmarks) {
        // 清空书签列表
        bookmarkList.innerHTML = '';
        
        // 如果没有书签
        if (bookmarks.length === 0) {
            bookmarkList.innerHTML = '<div class="no-bookmarks">此文件夹中没有书签</div>';
            return;
        }
        
        // 渲染每个书签
        bookmarks.forEach(function(bookmark) {
            // 跳过文件夹
            if (bookmark.url === undefined) return;
            
            // 创建书签项
            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'bookmark-item';
            
            // 获取网站图标
            const faviconUrl = 'https://www.google.com/s2/favicons?domain=' + new URL(bookmark.url).hostname;
            
            // 设置书签内容
            bookmarkItem.innerHTML = `
                <img class="bookmark-icon" src="${faviconUrl}" alt="图标">
                <div class="bookmark-title">${bookmark.title || '未命名'}</div>
                <div class="bookmark-url">${bookmark.url}</div>
            `;
            
            // 点击书签打开链接
            bookmarkItem.addEventListener('click', function() {
                chrome.tabs.create({ url: bookmark.url });
            });
            
            // 添加到列表
            bookmarkList.appendChild(bookmarkItem);
        });
    }
    
    // 搜索书签
    function searchBookmarks(query) {
        if (!query) {
            // 如果搜索词为空，显示当前文件夹的书签
            loadBookmarksInFolder(currentFolderId);
            return;
        }
        
        // 使用Chrome书签API搜索
        chrome.bookmarks.search(query, function(results) {
            renderBookmarkList(results);
        });
    }
});