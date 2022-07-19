/* UI container */
const UIContainerDiv = document.querySelector("div#UIContainer");

/* Tab reference */
let targetTab = {
	tabId: null,
	tabOrigin: null
}

/* Sync helper methods */
function getSyncedData(key, callback) {
	chrome.storage.sync.get(key, function(result) {
		console.log(`Get->Key '${key}':`, result[key]);
		callback(result[key]);
	});
}

function setSyncedData(key, value, callback = null) {
	chrome.storage.sync.set({[key]: value}, function() {
		console.log(`Set->Key '${key}':`, value);
		if (callback) {
			callback();
		}
	});
}

/* site interaction methods */

function runScriptInTab(tabId, func, args, callback) {
	chrome.scripting.executeScript({
		target: {tabId},
		func,
		args
	}, function(localSiteStorage) {
		const result = localSiteStorage[0].result;
		console.log('runScriptInTab->result', result);
		callback(result);
	});
}

function getSiteLocalStorage(tabId, callback) {
	runScriptInTab(tabId, (() => {return JSON.parse(JSON.stringify(localStorage))}), [], function(localSiteStorage) {
		callback(localSiteStorage);
	});
}

function setSiteLocalStorage(tabId, localStorageNewValue, callback = null) {
	runScriptInTab(tabId, ((localStorageNewValue) => {
		Object.keys(localStorageNewValue).forEach((localStorageKey) => {
			localStorage[localStorageKey] = localStorageNewValue[localStorageKey];
		})
	}), [localStorageNewValue], function() {
		if (callback) {
			callback();
		}
	});
}

/* site sync methods */

function getSiteSyncStatus(remoteSiteStorage, callback) {
	getSiteLocalStorage(targetTab.tabId, function(localSiteStorage) {
		const siteSyncStatus = Object.keys({...localSiteStorage, ...remoteSiteStorage.data}).map(storageKey => {
			return {
				storageKey: storageKey,
				localValue: localSiteStorage[storageKey],
				remoteValue: remoteSiteStorage.data[storageKey],
				valueInSync: localSiteStorage[storageKey] == remoteSiteStorage.data[storageKey]
			}
		});
		callback(siteSyncStatus);
	});
}

function updateSiteSyncedData(keys = [], preferRemote = true) {
	
	// get remote data and then merge local data
	getSyncedData(targetTab.tabOrigin, function(remoteSiteStorage) {
		
		getSiteLocalStorage(targetTab.tabId, function(localSiteStorage) {
			
			// if we only want to update some values from localstorage
			if (keys.length) {
				
				// delete ones not listed
				Object.keys(localSiteStorage).filter(storageItemKey => keys.includes(storageItemKey)).forEach(storageItemKey => {
					delete localSiteStorage[storageItemKey];
				})
			}			
			
			const syncData = {
				tracked: true,
				date: (new Date()).toLocaleString(),
				data: preferRemote ? {...localSiteStorage, ...remoteSiteStorage?.data} : {...remoteSiteStorage?.data, ...localSiteStorage}
			}
			setSyncedData(targetTab.tabOrigin, syncData, function() {
				showMainUI();
			});
		});
			
	});
	
	
}

function clearSiteSyncedData() {
	setSyncedData(targetTab.tabOrigin, {}, function() {
		showMainUI();
	});
}

/* UI methods */

function addTrackSiteButton() {
	const buttonHTML = `<button id="trackSite">Track ${targetTab.tabOrigin}</button>`
	UIContainerDiv.insertAdjacentHTML('beforeend', buttonHTML);
	
	const trackSiteButton = document.querySelector("button#trackSite");
	trackSiteButton.onclick = function() {
		updateSiteSyncedData();	
	};
}

function showBackButton() {
	
	// build button
	const backButtonHTML = '<button id="backButton"> Back </button>';
	
	// render
	UIContainerDiv.insertAdjacentHTML('beforeend', backButtonHTML);
	
	// listen for button click
	document.querySelector('button#backButton').onclick = function() {
		showMainUI();
	};
}

/* UI */

function showSiteOverviewUI(remoteSiteStorage) {
	
	/* add overview info and buttons */
	const overviewHTML = `
	<ul>
		<li><strong>Site Origin</strong>: ${targetTab.tabOrigin}</li>
		<li><strong>Last Synced</strong>: ${remoteSiteStorage.date}</li>
	</ul>
	<!--<button id="syncSite">Sync Site</button>-->
	<button id="untrackSite">Untrack Site</button>`;
	UIContainerDiv.insertAdjacentHTML('beforeend', overviewHTML);
	
	/*
	document.querySelector("button#syncSite").onclick = function() {
		updateSiteSyncedData();
	};
	*/
	
	document.querySelector("button#untrackSite").onclick = function() {
		clearSiteSyncedData();
	};
	
	// get site sync status and render to a table
	getSiteSyncStatus(remoteSiteStorage, function(siteSyncStatus) {
		
		// build table html
		const tableHTML = `
		<table id="dataTable">
		<thead>
			<tr>
				<th>Key</th>
				<th>In Sync</th>
			</tr>
		</thead>
		<tbody>
		</tbody>
		</table>`;
		
		// render
		UIContainerDiv.insertAdjacentHTML('beforeend', tableHTML);

		// build row html
		const tableRowsHTML = siteSyncStatus.map((storageEntry, storageEntryIndex) => {
			const entryRowHTML = `
			<tr id="storageEntry-${storageEntryIndex}">
				<td>
					${storageEntry.storageKey}
				</td>
				<td title="Local Value: ${storageEntry.localValue}, Remote Value: ${storageEntry.remoteValue}">
					${storageEntry.valueInSync ? '✔️' : '❌'}
				</td>
			</tr>`
			
			// render
			document.querySelector('table#dataTable tbody').insertAdjacentHTML('beforeend', entryRowHTML);
			
			// listen for row click
			document.querySelector(`table#dataTable tbody tr#storageEntry-${storageEntryIndex}`).onclick = function() {
				showEntryUI(storageEntry)
			};
		})
	})	
}

function showEntryUI(storageEntry) {


	// clear down/empty the UI
	UIContainerDiv.innerHTML = "";
	
	// add back button to return to main ui
	showBackButton();
	
	// build ui
	const entryViewHTML = `
	<table id="entryTable">
		<thead>
			<tr>
				<th colspan="2">${storageEntry.storageKey}</th>
			</tr>
			<tr>
				<th>Local Value</th>
				<th>Remote Value</th>
			</tr>
		</thead>
			<tr>
				<td>
					<textarea readonly>${storageEntry.localValue}</textarea>
				</td>
				<td>
					<textarea readonly>${storageEntry.remoteValue}</textarea>
				</td>
			</tr>
			<tr>
				<td>
					<button id="useLocalValue">
						Use Local Value
					</button>
				</td>
				<td>
					<button id="useRemoteValue">
						Use Remote Value
					</button>
				</td>
			</tr>	
		<tbody>
		</tbody>
	</table>`;
	
	// render
	UIContainerDiv.insertAdjacentHTML('beforeend', entryViewHTML);
	
	// listen for button clicks
	document.querySelector("button#useLocalValue").onclick = function() {
		getSiteLocalStorage(targetTab.tabId, function(localSiteStorage) {
			updateSiteSyncedData([localSiteStorage.storageKey], false);
		});
	};
	
	document.querySelector("button#useRemoteValue").onclick = function() {
		getSiteLocalStorage(targetTab.tabId, function(localSiteStorage) {
			localSiteStorage[storageEntry.storageKey] = storageEntry.remoteValue;
			
			console.log('useRemoteValue->storageEntry', storageEntry);
			console.log('useRemoteValue->localSiteStorageA', localSiteStorage);
			setSiteLocalStorage(targetTab.tabId, localSiteStorage, function() {
				updateSiteSyncedData([localSiteStorage.storageKey]);
			});
		});
	};
}

function showMainUI() {
	
	// clear down/empty the UI
	UIContainerDiv.innerHTML = "";
	
	// retrieve any synced data for site
	getSyncedData(targetTab.tabOrigin, function(remoteSiteStorage) {
		
		// if site is already tracked or not
		const currentSiteTracked = remoteSiteStorage && remoteSiteStorage.hasOwnProperty('tracked') && remoteSiteStorage.tracked === true;
		if (currentSiteTracked) {
			// show site sync overview
			showSiteOverviewUI(remoteSiteStorage);
		} else {
			// show button for tracking site
			addTrackSiteButton();
		}
	});
}

/* get active tab info and then initialize UI */
chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
	tabURL = new URL(tabs[0].url);
	targetTab = {
		tabId: tabs[0].id,
		tabOrigin: tabURL.origin + tabURL.pathname.slice(0, tabURL.pathname.lastIndexOf('/'))
	}
	showMainUI();
});

