// 在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const bookmarkFolders = document.getElementById('bookmark-folders');
    const bookmarkList = document.getElementById('bookmark-list');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    // 当前文件夹ID
    let currentFolderId = '1'; // 默认为书签栏
    
    // 拖拽相关变量
    let draggedItem = null;
    let draggedItemIndex = -1;
    
    // 初始化批量操作功能
    enableBatchOperations();
    
    // 显示批量操作按钮
    document.querySelector('.batch-operations').style.display = 'flex';
    
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
        bookmarks.forEach(function(bookmark, index) {
            // 跳过文件夹
            if (bookmark.url === undefined) return;
            
            // 创建书签项
            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'bookmark-item';
            bookmarkItem.dataset.id = bookmark.id;
            bookmarkItem.dataset.index = index;
            bookmarkItem.draggable = true; // 启用拖拽
            
            // 获取网站图标
            const faviconUrl = 'https://www.google.com/s2/favicons?domain=' + new URL(bookmark.url).hostname;
            
            // 设置书签内容
            bookmarkItem.innerHTML = `
                <div class="bookmark-content">
                    <input type="checkbox" class="bookmark-checkbox">
                    <img class="bookmark-icon" src="${faviconUrl}" alt="图标">
                    <div class="bookmark-info">
                        <div class="bookmark-title">${bookmark.title || '未命名'}</div>
                        <div class="bookmark-url">${bookmark.url}</div>
                    </div>
                </div>
                <div class="bookmark-actions">
                    <button class="edit-btn" title="编辑">✏️</button>
                    <button class="delete-btn" title="删除">🗑️</button>
                </div>
            `;
            
            // 点击书签打开链接或选择书签（在批量模式下）
            bookmarkItem.querySelector('.bookmark-content').addEventListener('click', function(e) {
                // 如果点击的是按钮区域，不处理
                if (e.target.closest('.bookmark-actions')) return;
                
                // 在批量模式下，点击书签项切换选中状态
                if (document.body.classList.contains('batch-mode')) {
                    e.preventDefault(); // 阻止默认行为
                    e.stopPropagation(); // 阻止冒泡
                    
                    // 切换选中状态
                    const isSelected = bookmarkItem.classList.toggle('selected');
                    const itemCheckbox = bookmarkItem.querySelector('.bookmark-checkbox');
                    itemCheckbox.checked = isSelected;
                    
                    // 更新选中计数
                    const selectedCountSpan = document.getElementById('selected-count');
                    const selectedCount = document.querySelectorAll('.bookmark-item.selected').length;
                    selectedCountSpan.textContent = `已选择 ${selectedCount} 项`;
                } else {
                    // 非批量模式下，点击打开链接
                    chrome.tabs.create({ url: bookmark.url });
                }
            });
            
            // 编辑按钮点击事件
            bookmarkItem.querySelector('.edit-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                showEditDialog(bookmark);
            });
            
            // 删除按钮点击事件
            bookmarkItem.querySelector('.delete-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                if (confirm(`确定要删除书签 "${bookmark.title}" 吗？`)) {
                    chrome.bookmarks.remove(bookmark.id, function() {
                        loadBookmarksInFolder(currentFolderId);
                    });
                }
            });
            
            // 拖拽开始事件
            bookmarkItem.addEventListener('dragstart', function(e) {
                draggedItem = bookmarkItem;
                draggedItemIndex = index;
                setTimeout(() => {
                    bookmarkItem.classList.add('dragging');
                }, 0);
            });
            
            // 拖拽结束事件
            bookmarkItem.addEventListener('dragend', function() {
                bookmarkItem.classList.remove('dragging');
                draggedItem = null;
                draggedItemIndex = -1;
            });
            
            // 拖拽经过事件
            bookmarkItem.addEventListener('dragover', function(e) {
                e.preventDefault();
                if (draggedItem && draggedItem !== bookmarkItem) {
                    const rect = bookmarkItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    if (e.clientY < midY) {
                        bookmarkItem.classList.add('drag-over-top');
                        bookmarkItem.classList.remove('drag-over-bottom');
                    } else {
                        bookmarkItem.classList.add('drag-over-bottom');
                        bookmarkItem.classList.remove('drag-over-top');
                    }
                }
            });
            
            // 拖拽离开事件
            bookmarkItem.addEventListener('dragleave', function() {
                bookmarkItem.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
            // 拖拽放置事件
            bookmarkItem.addEventListener('drop', function(e) {
                e.preventDefault();
                bookmarkItem.classList.remove('drag-over-top', 'drag-over-bottom');
                
                if (draggedItem && draggedItem !== bookmarkItem) {
                    const targetIndex = parseInt(bookmarkItem.dataset.index);
                    const draggedId = draggedItem.dataset.id;
                    const rect = bookmarkItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    // 确定移动位置（前或后）
                    let newIndex = targetIndex;
                    if (e.clientY > midY) {
                        newIndex += 1;
                    }
                    
                    // 如果拖拽项在目标项之前，需要调整索引
                    if (draggedItemIndex < targetIndex) {
                        newIndex -= 1;
                    }
                    
                    // 移动书签
                    chrome.bookmarks.move(draggedId, {
                        parentId: currentFolderId,
                        index: newIndex
                    }, function() {
                        loadBookmarksInFolder(currentFolderId);
                    });
                }
            });
            
            // 添加到列表
            bookmarkList.appendChild(bookmarkItem);
        });
        
        // 为书签列表添加右键菜单
        bookmarkList.addEventListener('contextmenu', function(e) {
            const bookmarkItem = e.target.closest('.bookmark-item');
            if (bookmarkItem) {
                e.preventDefault();
                showContextMenu(e, bookmarkItem.dataset.id);
            }
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
    
    // 显示编辑对话框
    function showEditDialog(bookmark) {
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'edit-dialog';
        dialog.innerHTML = `
            <div class="edit-dialog-content">
                <h3>编辑书签</h3>
                <div class="form-group">
                    <label for="edit-title">标题</label>
                    <input type="text" id="edit-title" value="${bookmark.title || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-url">URL</label>
                    <input type="text" id="edit-url" value="${bookmark.url || ''}">
                </div>
                <div class="dialog-buttons">
                    <button id="cancel-edit">取消</button>
                    <button id="save-edit">保存</button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(dialog);
        
        // 获取输入框和按钮
        const titleInput = document.getElementById('edit-title');
        const urlInput = document.getElementById('edit-url');
        const cancelButton = document.getElementById('cancel-edit');
        const saveButton = document.getElementById('save-edit');
        
        // 聚焦标题输入框
        titleInput.focus();
        
        // 取消按钮点击事件
        cancelButton.addEventListener('click', function() {
            document.body.removeChild(dialog);
        });
        
        // 保存按钮点击事件
        saveButton.addEventListener('click', function() {
            const newTitle = titleInput.value.trim();
            const newUrl = urlInput.value.trim();
            
            if (!newTitle || !newUrl) {
                alert('标题和URL不能为空！');
                return;
            }
            
            // 更新书签
            chrome.bookmarks.update(bookmark.id, {
                title: newTitle,
                url: newUrl
            }, function() {
                document.body.removeChild(dialog);
                loadBookmarksInFolder(currentFolderId);
            });
        });
    }
    
    // 显示右键菜单
    function showContextMenu(event, bookmarkId) {
        // 移除已有的右键菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // 获取书签信息
        chrome.bookmarks.get(bookmarkId, function(bookmarks) {
            if (bookmarks.length === 0) return;
            const bookmark = bookmarks[0];
            
            // 创建右键菜单
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.top = `${event.clientY}px`;
            menu.style.left = `${event.clientX}px`;
            menu.innerHTML = `
                <div class="menu-item" id="menu-open">在新标签页中打开</div>
                <div class="menu-item" id="menu-edit">编辑书签</div>
                <div class="menu-item" id="menu-delete">删除书签</div>
            `;
            
            // 添加到页面
            document.body.appendChild(menu);
            
            // 打开链接
            document.getElementById('menu-open').addEventListener('click', function() {
                chrome.tabs.create({ url: bookmark.url });
                document.body.removeChild(menu);
            });
            
            // 编辑书签
            document.getElementById('menu-edit').addEventListener('click', function() {
                showEditDialog(bookmark);
                document.body.removeChild(menu);
            });
            
            // 删除书签
            document.getElementById('menu-delete').addEventListener('click', function() {
                if (confirm(`确定要删除书签 "${bookmark.title}" 吗？`)) {
                    chrome.bookmarks.remove(bookmark.id, function() {
                        loadBookmarksInFolder(currentFolderId);
                    });
                }
                document.body.removeChild(menu);
            });
            
            // 点击其他区域关闭菜单
            document.addEventListener('click', function closeMenu() {
                if (document.body.contains(menu)) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            });
        });
    }
    
    // 批量操作功能
    function enableBatchOperations() {
        // 获取批量操作相关元素
        const batchModeBtn = document.getElementById('batch-mode-btn');
        const selectAllBtn = document.getElementById('select-all-btn');
        const moveSelectedBtn = document.getElementById('move-selected-btn');
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const exportSelectedBtn = document.getElementById('export-selected-btn');
        const cancelBatchBtn = document.getElementById('cancel-batch-btn');
        const selectedCountSpan = document.getElementById('selected-count');
        const batchOperationsDiv = document.querySelector('.batch-operations');
        
        // 批量操作模式切换
        batchModeBtn.addEventListener('click', function() {
            document.body.classList.add('batch-mode');
            batchOperationsDiv.classList.add('active');
            updateSelectedCount();
        });
        
        // 取消批量操作模式
        cancelBatchBtn.addEventListener('click', function() {
            document.body.classList.remove('batch-mode');
            batchOperationsDiv.classList.remove('active');
            // 取消所有选中状态
            document.querySelectorAll('.bookmark-item').forEach(item => {
                item.classList.remove('selected');
                item.querySelector('.bookmark-checkbox').checked = false;
            });
        });
        
        // 全选按钮
        selectAllBtn.addEventListener('click', function() {
            const allItems = document.querySelectorAll('.bookmark-item');
            const allSelected = Array.from(allItems).every(item => item.classList.contains('selected'));
            
            allItems.forEach(item => {
                if (allSelected) {
                    // 如果全部已选中，则取消全选
                    item.classList.remove('selected');
                    item.querySelector('.bookmark-checkbox').checked = false;
                } else {
                    // 否则全选
                    item.classList.add('selected');
                    item.querySelector('.bookmark-checkbox').checked = true;
                }
            });
            
            updateSelectedCount();
        });
        
        // 删除选中的书签
        deleteSelectedBtn.addEventListener('click', function() {
            const selectedItems = document.querySelectorAll('.bookmark-item.selected');
            if (selectedItems.length === 0) {
                alert('请先选择要删除的书签');
                return;
            }
            
            if (confirm(`确定要删除选中的 ${selectedItems.length} 个书签吗？`)) {
                // 创建一个Promise数组来跟踪所有删除操作
                const deletePromises = [];
                
                selectedItems.forEach(item => {
                    const bookmarkId = item.dataset.id;
                    const promise = new Promise((resolve) => {
                        chrome.bookmarks.remove(bookmarkId, resolve);
                    });
                    deletePromises.push(promise);
                });
                
                // 等待所有删除操作完成后刷新列表
                Promise.all(deletePromises).then(() => {
                    loadBookmarksInFolder(currentFolderId);
                    // 退出批量模式
                    cancelBatchBtn.click();
                });
            }
        });
        
        // 移动选中的书签
        moveSelectedBtn.addEventListener('click', function() {
            const selectedItems = document.querySelectorAll('.bookmark-item.selected');
            if (selectedItems.length === 0) {
                alert('请先选择要移动的书签');
                return;
            }
            
            // 获取所有文件夹
            chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
                // 构建文件夹选择对话框
                const folderSelectDialog = document.createElement('div');
                folderSelectDialog.className = 'folder-select-dialog';
                folderSelectDialog.innerHTML = `
                    <div class="folder-select-content">
                        <h3>选择目标文件夹</h3>
                        <div id="folder-select-tree" class="tree-view"></div>
                        <div class="folder-select-actions">
                            <button id="folder-select-cancel">取消</button>
                            <button id="folder-select-confirm">确定</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(folderSelectDialog);
                
                // 渲染文件夹树
                const folderSelectTree = document.getElementById('folder-select-tree');
                let selectedFolderId = null;
                
                function renderFolderTree(nodes, parentElement) {
                    nodes.forEach(function(node) {
                        if (node.children) {
                            const folderItem = document.createElement('div');
                            folderItem.className = 'tree-item folder';
                            folderItem.textContent = node.title;
                            folderItem.dataset.id = node.id;
                            
                            folderItem.addEventListener('click', function(e) {
                                e.stopPropagation();
                                // 设置选中的文件夹ID
                                selectedFolderId = node.id;
                                // 移除其他选中状态
                                document.querySelectorAll('.tree-item.selected').forEach(item => {
                                    item.classList.remove('selected');
                                });
                                // 添加选中状态
                                folderItem.classList.add('selected');
                            });
                            
                            parentElement.appendChild(folderItem);
                            
                            // 如果有子文件夹，递归渲染
                            if (node.children.length > 0) {
                                const childrenContainer = document.createElement('div');
                                childrenContainer.className = 'tree-children';
                                parentElement.appendChild(childrenContainer);
                                
                                // 展开/折叠功能
                                folderItem.addEventListener('click', function() {
                                    childrenContainer.classList.toggle('open');
                                    folderItem.classList.toggle('open');
                                });
                                
                                renderFolderTree(node.children, childrenContainer);
                            }
                        }
                    });
                }
                
                renderFolderTree(bookmarkTreeNodes, folderSelectTree);
                
                // 取消按钮
                document.getElementById('folder-select-cancel').addEventListener('click', function() {
                    document.body.removeChild(folderSelectDialog);
                });
                
                // 确认按钮
                document.getElementById('folder-select-confirm').addEventListener('click', function() {
                    if (!selectedFolderId) {
                        alert('请选择一个目标文件夹');
                        return;
                    }
                    
                    // 移动所有选中的书签
                    const movePromises = [];
                    
                    selectedItems.forEach(item => {
                        const bookmarkId = item.dataset.id;
                        const promise = new Promise((resolve) => {
                            chrome.bookmarks.move(bookmarkId, { parentId: selectedFolderId }, resolve);
                        });
                        movePromises.push(promise);
                    });
                    
                    // 等待所有移动操作完成后刷新列表
                    Promise.all(movePromises).then(() => {
                        loadBookmarksInFolder(currentFolderId);
                        // 关闭对话框
                        document.body.removeChild(folderSelectDialog);
                        // 退出批量模式
                        cancelBatchBtn.click();
                    });
                });
            });
        });
        
        // 导出选中的书签
        exportSelectedBtn.addEventListener('click', function() {
            const selectedItems = document.querySelectorAll('.bookmark-item.selected');
            if (selectedItems.length === 0) {
                alert('请先选择要导出的书签');
                return;
            }
            
            // 构建导出数据
            const exportData = [];
            selectedItems.forEach(item => {
                exportData.push({
                    title: item.querySelector('.bookmark-title').textContent,
                    url: item.querySelector('.bookmark-url').textContent
                });
            });
            
            // 创建下载链接
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            
            const exportFileDefaultName = 'bookmarks-export.json';
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            // 退出批量模式
            cancelBatchBtn.click();
        });
        
        // 更新选中计数
        function updateSelectedCount() {
            const selectedCount = document.querySelectorAll('.bookmark-item.selected').length;
            selectedCountSpan.textContent = `已选择 ${selectedCount} 项`;
        }
        
        // 为书签列表添加事件委托，处理复选框点击
        bookmarkList.addEventListener('click', function(e) {
            if (document.body.classList.contains('batch-mode')) {
                const checkbox = e.target.closest('.bookmark-checkbox');
                const bookmarkItem = e.target.closest('.bookmark-item');
                
                if (checkbox) {
                    e.stopPropagation(); // 阻止冒泡，避免触发书签打开
                    
                    // 切换选中状态
                    bookmarkItem.classList.toggle('selected', checkbox.checked);
                    updateSelectedCount();
                } else if (bookmarkItem && !e.target.closest('.bookmark-actions')) {
                    // 在批量模式下点击书签项（非按钮区域）也可以选择
                    e.preventDefault(); // 阻止默认行为，避免打开书签
                    const isSelected = bookmarkItem.classList.toggle('selected');
                    const itemCheckbox = bookmarkItem.querySelector('.bookmark-checkbox');
                    itemCheckbox.checked = isSelected;
                    updateSelectedCount();
                }
            }
        });
    }
});