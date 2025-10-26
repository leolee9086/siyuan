// Main Siyuan SDK Client Entry Point

import { AccountApi } from './account.js';
import { AiApi } from './ai.js';
import { ArchiveApi } from './archive.js';
import { AssetApi } from './asset.js';
import { AttrApi } from './attr.js';
import { AvApi } from './av.js';
import { BazaarApi } from './bazaar.js';
import { BlockApi } from './block.js';
import { BookmarkApi } from './bookmark.js';
import { BroadcastApi } from './broadcast.js';
import { ClipboardApi } from './clipboard.js';
import { CloudApi } from './cloud.js';
import { ConvertApi } from './convert.js';
import { ExportApi } from './export.js';
import { ExtensionApi } from './extension.js';
import { FileApi } from './file.js';
import { FiletreeApi } from './filetree.js';
import { FormatApi } from './format.js';
import { GraphApi } from './graph.js';
import { HistoryApi } from './history.js';
import { IconApi } from './icon.js';
import { ImportApi } from './import.js';
import { InboxApi } from './inbox.js';
import { LuteApi } from './lute.js';
import { MiscApi } from './misc.js';
import { NetworkApi } from './network.js';
import { NotebookApi } from './notebook.js';
import { NotificationApi } from './notification.js';
import { OutlineApi } from './outline.js';
import { PetalApi } from './petal.js';
import { QueryApi } from './query.js';
import { RefApi } from './ref.js';
import { RepoApi } from './repo.js';
import { RiffApi } from './riff.js';
import { SearchApi } from './search.js';
import { SettingApi } from './setting.js';
import { SnippetApi } from './snippet.js';
import { SqliteApi } from './sqlite.js';
import { StorageApi } from './storage.js';
import { SyncApi } from './sync.js';
import { SystemApi } from './system.js';
import { TagApi } from './tag.js';
import { TemplateApi } from './template.js';
import { TransactionsApi } from './transactions.js';
import { UiApi } from './ui.js';

export class SiyuanClient {
    constructor({ baseUrl = 'http://127.0.0.1:6806', apiToken = '', customFetch } = {}) {
        this.baseUrl = baseUrl.replace(/$/, ''); // Ensure no trailing slash
        this.apiToken = apiToken;
        this.fetchInstance = customFetch || (typeof window !== 'undefined' ? window.fetch.bind(window) : global.fetch);
    }

    async fetcher(method, endpoint, params, needAuth) {
        let actualUrl = this.baseUrl + endpoint;
        const options = { method, headers: {} };

        if (needAuth && this.apiToken) {
            options.headers['Authorization'] = `Token ${this.apiToken}`; 
        }

        if (method === 'POST' || method === 'PUT') {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(params || {});
        } else if ((method === 'GET' || method === 'DELETE') && params && Object.keys(params).length > 0) {
            const filteredParams = {};
            for (const key in params) {
                if (params[key] !== undefined && params[key] !== null) {
                    filteredParams[key] = params[key];
                }
            }
            if (Object.keys(filteredParams).length > 0) {
                const queryParams = new URLSearchParams(filteredParams);
                actualUrl += `?${queryParams.toString()}`; 
            }
        }

        const response = await this.fetchInstance(actualUrl, options);

        if (!response.ok) {
            let errorData = 'Failed to parse error response';
            try { errorData = await response.json(); } catch (e) { try { errorData = await response.text(); } catch (e2) { /* ignore */ } }
            console.error(`API Error [${method} ${actualUrl}]: ${response.status}`, errorData);
            const err = new Error(`API Error ${response.status} for ${method} ${endpoint}`); 
            err.data = errorData; err.status = response.status; err.response = response;
            throw err;
        }

        const contentType = response.headers.get('content-type');
        if (response.status === 204 || !contentType) { return undefined; }
        if (contentType.includes('application/json')) { return response.json(); }
        return response.text();
    }

    // API Group Instances
    account = new AccountApi(this.fetcher.bind(this));
    ai = new AiApi(this.fetcher.bind(this));
    archive = new ArchiveApi(this.fetcher.bind(this));
    asset = new AssetApi(this.fetcher.bind(this));
    attr = new AttrApi(this.fetcher.bind(this));
    av = new AvApi(this.fetcher.bind(this));
    bazaar = new BazaarApi(this.fetcher.bind(this));
    block = new BlockApi(this.fetcher.bind(this));
    bookmark = new BookmarkApi(this.fetcher.bind(this));
    broadcast = new BroadcastApi(this.fetcher.bind(this));
    clipboard = new ClipboardApi(this.fetcher.bind(this));
    cloud = new CloudApi(this.fetcher.bind(this));
    convert = new ConvertApi(this.fetcher.bind(this));
    _export = new ExportApi(this.fetcher.bind(this));
    extension = new ExtensionApi(this.fetcher.bind(this));
    file = new FileApi(this.fetcher.bind(this));
    filetree = new FiletreeApi(this.fetcher.bind(this));
    format = new FormatApi(this.fetcher.bind(this));
    graph = new GraphApi(this.fetcher.bind(this));
    history = new HistoryApi(this.fetcher.bind(this));
    icon = new IconApi(this.fetcher.bind(this));
    import = new ImportApi(this.fetcher.bind(this));
    inbox = new InboxApi(this.fetcher.bind(this));
    lute = new LuteApi(this.fetcher.bind(this));
    misc = new MiscApi(this.fetcher.bind(this));
    network = new NetworkApi(this.fetcher.bind(this));
    notebook = new NotebookApi(this.fetcher.bind(this));
    notification = new NotificationApi(this.fetcher.bind(this));
    outline = new OutlineApi(this.fetcher.bind(this));
    petal = new PetalApi(this.fetcher.bind(this));
    query = new QueryApi(this.fetcher.bind(this));
    ref = new RefApi(this.fetcher.bind(this));
    repo = new RepoApi(this.fetcher.bind(this));
    riff = new RiffApi(this.fetcher.bind(this));
    search = new SearchApi(this.fetcher.bind(this));
    setting = new SettingApi(this.fetcher.bind(this));
    snippet = new SnippetApi(this.fetcher.bind(this));
    sqlite = new SqliteApi(this.fetcher.bind(this));
    storage = new StorageApi(this.fetcher.bind(this));
    sync = new SyncApi(this.fetcher.bind(this));
    system = new SystemApi(this.fetcher.bind(this));
    tag = new TagApi(this.fetcher.bind(this));
    template = new TemplateApi(this.fetcher.bind(this));
    transactions = new TransactionsApi(this.fetcher.bind(this));
    ui = new UiApi(this.fetcher.bind(this));
}
