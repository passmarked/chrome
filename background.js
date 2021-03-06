/**
* Constants for us to use
**/
var CONSTANTS = {

	URL: {

		API: 'https://api.passmarked.com',
		WEB: 'https://passmarked.com'

	},
	CACHE: 60,
	INSTALL_KEY: 'install',
	STYLE: {

		CANVAS: [

			'cursor: pointer'

		].join(';')

	}

};

/**
* Sends a "install notice" to the Passmarked servers,
* which is also a welcome page for new users.
**/
function installNotice() {

	// check if not already set ...
	chrome.storage.sync.get(CONSTANTS.INSTALL_KEY, function(result) {

		// and .. ?
		if(!result.install) {

			// get current timestamp
		    var now = new Date().getTime();

		    // params to save
		    params = {};

		    // set our initial items
		    params[CONSTANTS.INSTALL_KEY] = JSON.stringify({

		    	timestamp: now

		    });

		    // set as a note
		    chrome.storage.sync.set(params, function() {

		    	// -- ENABLE TO VIEW THE CONTENT OF THE SYNC DATA STORAGE OBJECT
				// chrome.storage.sync.get(null, function (data) { console.info(data) });

		    	// open our welcome page with meta data
			    chrome.tabs.create({

			    	url: CONSTANTS.URL.WEB + '/welcome?' + [

			    		'client=chrome',
			    		'timestamp=' + now

			    	].join('&')

			    });

		    });

		}

	});

}

/**
* Returns a value from the cache but also checks the
* the timestamp first and clears cache if it's too old
**/
function byCache(key, fn) {

	// the timestamp key
	var timestamp_key = key + '.timestamp';

	// get by the key
	chrome.storage.local.get([ key, timestamp_key ], function(result) {

		// did we find anything
		if(result) {

			// current time
			var current_timestamp = new Date().getTime();

			// check the timestamp
			if( result[timestamp_key] &&
				( current_timestamp - result[timestamp_key] ) <= 1000 * 60 * CONSTANTS.CACHE ) {

				// output our item ..
				fn( JSON.parse(result[key]) )

			} else {

				// remove it
				chrome.storage.local.remove([ key, timestamp_key ], function() {

					// signal done and that nothing was found from cache ...
					fn(null);

				});

			}

		} else fn(null);

	});

}

/**
* Sets to the cache along with the timestamp
**/
function setCache(key, value, fn) {

	// the timestamp key
	var timestamp_key = key + '.timestamp';

	// params to set
	var params = {};

	// add in
	params[key] = JSON.stringify(value);
	params[timestamp_key] = new Date().getTime();

	// get by the key
	chrome.storage.local.set(params, function(){

		// signal that we are done
		fn(null);

	});

}

/**
* Returns the score info from the server
* using the cache and everything involved
**/
function getReportedInfo(domain, fn) {

	// key for the cache
	var cacheKey = domain.toLowerCase();

	// key for our local cache
	byCache(cacheKey, function(cached_details){

		if(cached_details) {

			// returns the cached items
			fn(cached_details);

		} else {

			// open a XHR for the request
			var xhr = new XMLHttpRequest();

			// open up a connection
			xhr.open("GET", CONSTANTS.URL.API + '/v1/query?' + [

				'source=chrome.ext',
				'domain=' + domain

			].join('&'), false);

			// handle the response
			xhr.onreadystatechange = function() {

				// handle when done
				if (xhr.readyState == 4) {

					// get our response
					var result = xhr.responseText;

					// can we parse it ?
					var jsonObj = null;

					// try to parse it
					try { jsonObj = JSON.parse(result); } catch(err) {}

					// could we parse ?
					if(jsonObj) {

						// save the url
						setCache(domain, jsonObj, function(){

							// return with info
							fn(jsonObj);

						});

					} else {

						// nope ...
						fn(null);

					}

				}

			};

			// send the request
			xhr.send();

		}

	});

}

/**
* Sets a Blank icon or just makes sure it's showing
**/
function showBlankIcon(tabId) {

	// set the icon
	chrome.pageAction.setIcon({

		tabId: tabId,
		path: {

			38: 'faces/face.png',
			19: 'faces/face.png'

		}

	}, function(){

		// show the page action to the tab this is active on
    	chrome.pageAction.show(tabId);

	});

}

/**
* Sets a Icon that has a score showing
**/
function showScoreIcon(tabId, score) {

	// sanity check if we should render blank
	// icon for  a 'null' score
	if(!score) {

		// show a blank icon rather then
		showBlankIcon(tabId);
		return;

	}

	// pad the score
	var paddedScore = '' + Math.floor(score).toString();
	if(paddedScore.length == 1)
		paddedScore = '0' + paddedScore;

	// set the icon
	chrome.pageAction.setIcon({

		tabId: tabId, 
		path: {

			38: 'faces/' + paddedScore + '.png',
			19: 'faces/' + paddedScore + '.png'

		}

	}, function(){

		// show the page action to the tab this is active on
    	chrome.pageAction.show(tabId);

	});

}

/**
* Returns a color according to the score
**/
function colorByScore(score) {

	// local variable
	var parsedScore = null;
	var baseColor = null;

	// parse to int
	try { parsedScore = parseInt(score); } catch(err) {}

	// check we found a score ...
	if(!parsedScore) baseColor = 'd44937';
	else if(parsedScore < 45) baseColor = 'f72d49';
	else if(parsedScore < 70) baseColor = 'f96b25';
	else if(parsedScore >= 70) baseColor = '78cbd1';

	// returns the color according to score
	return colorLuminance(baseColor, -(1 - ( parsedScore/100 )) );

}

/**
* Returns color darker or lighter,
* -0.1 = 10% darker, 0.1 = 10% lighter
**/
function colorLuminance(hex, lum) {

	// validate hex string
	hex = String(hex).replace(/[^0-9a-f]/gi, '');
	if (hex.length < 6) {
		hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
	}
	lum = lum || 0;

	// convert to decimal and change luminosity
	var rgb = "#", c, i;
	for (i = 0; i < 3; i++) {

		c = parseInt(hex.substr(i*2,2), 16);
		c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
		rgb += ("00"+c).substr(c.length);

	}

	// returns the rgb
	return rgb;

}

/**
* Returns a domain by the url given
**/
function getDomainByUrl(url) {

	// returns the domain by the full url
	return URI(url).hostname();

}

/**
* Decides if we should show the icon on a url
**/
function allowActionByUrl(url) {

	// check if it's blank,
	// more a sanity check
	// than anything else
	if(!url) return false;

	// the lowered url
	url = (url || '').toLowerCase()

	// check if this is not a internal chrome page
	if(	url.indexOf('http://') != 0 &&
		url.indexOf('https://') != 0 ) return false;

	// check for local host
	if(url.indexOf('://localhost') != -1) return false;
	
	// default is true
	return true;

}

/**
* Handle a click on the page icon
**/
chrome.pageAction.onClicked.addListener(function(tab){

	// handle it
	var url = tab.url;

	// get the domain
	var hostname = getDomainByUrl(url);

	// check if not the password result website
	if(url.indexOf('passmarked.com') != -1 && url.replace('http:').split('/').length > 4) {

		// do not allow the result pages to be checked ..
		chrome.tabs.create({

			url: CONSTANTS.URL.WEB + '/dawg?' + [

				'url=' + encodeURIComponent(url),
				'source=chrome.ext'

			].join('&')

		}, function() {

			// cool open, will add here if anything is needed ...

		});

	} else {

		// get all the data
		getReportedInfo( hostname, function(report_overview_obj){

			// did we find one ?
			chrome.tabs.create({

				url: CONSTANTS.URL.API + '/v1/redirect?' + [

					'url=' + encodeURIComponent(url),
					'source=chrome.ext'

				].join('&')

			}, function() {

				// cool open, will add here if anything is needed ...

			});

		} );

	}

});

/**
* Handles when a url is created
**/
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {

	// check if we should worry
	if(!allowActionByUrl(tab.url)) return;

	// get the domain
	var domain = getDomainByUrl(tab.url);

	// check if we have a score for this domain
	getReportedInfo(domain, function(result){

		// did we find a item for the page ?
		if( result && result.count > 0 ) {

			// render the actual score we have
			showScoreIcon(tabId, result.score);

		} else {

			// render the blank icon for this page
			showBlankIcon(tabId);

		}

	});
	
});

/**
* Listens for commands from our website
**/
chrome.runtime.onMessage.addListener(

	function(request, sender, sendResponse) {

		// is this from a website ?
		if(sender.tab) {

			if(request.command == 'installed') {

				// get the install time
				chrome.storage.sync.get([ CONSTANTS.INSTALL_KEY ], function(result) {

					// remove from storage
					sendResponse({ status: "ok", timestamp: result[CONSTANTS.INSTALL_KEY] });

				});

			} else if(request.command == 'bust') {

				// the timestamp key
				var timestamp_key = request.key + '.timestamp';

				// remove it
				chrome.storage.local.remove([ request.key, timestamp_key ], function() {

					// signal done and that nothing was found from cache ...
					// remove from storage
					sendResponse({ status: "ok"});

				});

			}

		}

	}

);

// run our install notice
installNotice();