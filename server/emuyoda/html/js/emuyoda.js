/*
 * emuyoda.js - AngularJS Application to interface with YodaAPI on server
 *
 * Author: Lord Kator <lordkator@swgemu.com>
 *
 * Created: Sat Jan 16 07:28:29 EST 2016
 */
var emuYodaApp = angular.module('emuYoda', ['ui.router', 'ngSanitize', 'ngAnimate', 'ui.bootstrap']);

emuYodaApp.factory('yodaApiService', function($rootScope, $http) {
    var authenticateUser = function(username, password) {
	return $http.post("/api/auth", { auth: { username: username, password: password } }).then(function(r) {
	    if(r.data.response.token) {
		$rootScope.currentUsername = username;
		$rootScope.authToken = r.data.response.token;
	    } else {
		delete $rootScope.currentUsername;
		delete $rootScope.authToken;
	    }

	    return r.data;
	}).catch(function() {
	    delete $rootScope.currentUsername;
	    delete $rootScope.authToken;
	});
    };

    var getConfig = function() {
	return $http.get("/api/config").then(function(response) {
	    return response.data;
	});
    };

    var putConfig = function(data) {
	return $http.put("/api/config", data).then(function(r) {
	    return r.data;
	});
    };

    var updateConfig = function(config) {
	return $http.put("/api/config", config).then(function(response) {
	    return response.data;
	});
    };

    var getStatus = function() {
	return $http.get("/api/status").then(function(response) {
	    return response.data;
	});
    };

    var serverCommand = function(cmd) {
	return $http.get("/api/control?command=" + cmd).then(function(response) {
	    return response.data;
	});
    };

    var getAccount = function() {
	return $http.get("/api/account").then(function(response) {
	    return response.data;
	});
    };

    var addAccount = function(account) {
	return $http.post("/api/account", account).then(function(response) {
	    return response.data;
	});
    };

    return {
	addAccount: addAccount,
	authenticateUser: authenticateUser,
	getAccount: getAccount,
	getConfig: getConfig,
	putConfig: putConfig,
	getStatus: getStatus,
	serverCommand: serverCommand,
	updateConfig: updateConfig,
    };
});

emuYodaApp.factory('authInterceptor', function ($rootScope, $q, $window) {
  return {
    request: function (config) {
      config.headers = config.headers || {};
      if ($rootScope.authToken) {
        config.headers.Authorization = $rootScope.authToken;
      }
      return config;
    },
    response: function (response) {
      if (response.status === 401) {
	delete $rootScope.currentUsername;
	delete $rootScope.authToken;
      }
      return response || $q.when(response);
    }
  };
});

emuYodaApp.config(function($stateProvider, $urlRouterProvider, $httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');

    $urlRouterProvider.otherwise("/home");

    $stateProvider

    .state('home', {
	url         : '/home',
	templateUrl : 'pages/home.html',
	controller  : 'mainController',
	data        : { requireLogin: false },
    })
    .state('connect', {
	url         : '/connect',
	templateUrl : 'pages/connect.html',
	controller  : 'connectController',
	data        : { requireLogin: false },
    })
    .state('control', {
	url         : '/control',
	templateUrl : 'pages/control.html',
	controller  : 'controlController',
	data        : { requireLogin: true },
    })
    .state('tools', {
	url         : '/tools',
	templateUrl : 'pages/tools.html',
	controller  : 'toolsController',
	data        : { requireLogin: false },
    })
    .state('about', {
	url         : '/about',
	templateUrl : 'pages/about.html',
	data        : { requireLogin: false },
    })
    .state('login', {
	url         : '/login',
	data        : { requireLogin: true },
	controller  : function($state) {
	    $state.go("home");
        }
    })
    .state('logout', {
	url         : '/logout',
	data        : { requireLogin: true },
	controller  : function($state, $rootScope) {
	    delete $rootScope.currentUsername;
	    delete $rootScope.authToken;
	    $state.go("home");
        }
    })
    ;

});

emuYodaApp.controller('mainController', function($scope, $q, $location, yodaApiService) {
    $scope.cfg = {};
    $scope.server_status = {};
    $scope.account = {};
    $scope.zones = {};
    $scope.canCreateAdminAccount = false;
    $scope.shouldConfigureZones = false;

    $scope.isActive = function(viewLocation) { return viewLocation === $location.path(); }

    $scope.loadData = function() {
	$scope.canCreateAdminAccount = false;
	$scope.shouldConfigureZones = false;

	$q.all([
	    yodaApiService.getConfig().then(function(data) {
		$scope.cfg = data.response.config;
		$scope.messages = "";

		if (data.response.error) {
		    $scope.messages = "API CALL TO " + data.response.service + " FAILED WITH ERROR: " + data.response.error;
		    console.log($scope.messages);
		}

		if ($scope.cfg && $scope.cfg.emu && $scope.cfg.emu.ZonesEnabled) {
		    $scope.cfg.emu.ZonesEnabled.forEach( function(zone) {
			$scope.zones[zone] = true;
		    });
		}
	    }).catch(function() {
		$scope.error = "/api/config call failed";
	    })
	,
	    yodaApiService.getStatus().then(function(data) {
		$scope.server_status = data.response.server_status;
	    }).catch(function() {
		$scope.error = "/api/status call failed";
	    })
    	]).then(function() {
	    if($scope.server_status.num_accounts == 0 && $scope.server_status.account && $scope.server_status.account.admin_level >= 15) {
		$scope.canCreateAdminAccount = true;
		$scope.shouldConfigureZones = false;
	    }

	    if($scope.server_status.num_accounts == 1 && $scope.server_status.account && $scope.server_status.account.admin_level >= 15) {
		if($scope.cfg.emu.ZonesEnabled.length <= 2) {
		    $scope.shouldConfigureZones = true;
		}
	    }
	});
    }

    $scope.createAdminAccount = function() {
	$scope.canCreateAdminAccount = false;
	$scope.account.admin_level = 15;
	yodaApiService.addAccount({ account: $scope.account }).then(function(data) {
	    if(data.response.status == "OK") {
		alert("Account " + $scope.account.username + " Created!");
	    }
	    $scope.messages = JSON.stringify(data.response);
	    $scope.loadData();
	}).catch(function() {
	    $scope.messages = "account POST failed";
	})
    }

    $scope.enableZones = function() {
	$scope.zones['tutorial'] = true;
	$scope.zones['tatooine'] = true;
	$scope.shouldConfigureZones = false;

	var z = [ ];

	for(zone in $scope.zones) {
	    if($scope.zones[zone]) {
		z.push(zone);
	    }
	}

	yodaApiService.updateConfig({ config: { emu: { ZonesEnabled: z } } }).then(function(data) {
	    if(data.response.status == "OK") {
		alert("Zones Updated");
	    }
	    $scope.messages = JSON.stringify(data.response);
	    $scope.loadData();
	}).catch(function() {
	    $scope.messages = "config PUT failed";
	})
    }

    $scope.loadData();
});

emuYodaApp.controller('connectController', function($scope, yodaApiService) {
    yodaApiService.getStatus().then(function(data) {
	$scope.server_status = data.response.server_status;
    }).catch(function() {
	$scope.error = "/api/status call failed";
    });
});

emuYodaApp.controller('toolsController', function($scope, $http, $sce, yodaApiService) {
    $scope.referenceContent = "";
    $scope.referenceURI = "";
    $scope.displayReference = function(uri) {
	$scope.referenceURI = $sce.trustAsResourceUrl(uri);
    }
});

emuYodaApp.controller('controlController', function($rootScope, $scope, $timeout, $location, yodaApiService) {
    $scope.pendingCmd = "";
    $scope.pendingSend = false;
    $scope.sendText = "";
    $scope.autostart_server = false;

    $scope.updateStatus = function() {
	yodaApiService.getStatus().then(function(data) {
	    $scope.server_status = data.response.server_status;
	}).catch(function() {
	    $scope.error = "/api/status call failed";
	});
    };

    $scope.updateServerOptions = function() {
	console.log("updateServerOptions: $scope.autostart_server = " + $scope.autostart_server);
	var newcfg = {
	    config: {
		yoda: {
		    flags: {
			autostart_server: $scope.autostart_server,
		    }
		}
	    }
	};
	console.log("updateServerOptions: newcfg = " + JSON.stringify(newcfg));

	yodaApiService.putConfig(newcfg).then(function(data) {
	    if (data.response.error) {
		$scope.consoleAppend("update server options>> ERROR: " + data.response.error_description, "danger");
	    } else {
		$scope.consoleAppend("update server options>> Set autostart_server to " + newcfg.config.yoda.flags.autostart_server, "success");
	    }
	}).catch(function() {
	    console.log("/api/config call failed");
	});
    };

    $scope.consoleAppend = function(text, className) {
	// TODO has to be a more AngularJS way to do this...
	var e = document.getElementById('logPre');

	if(e) {
	    var lines = text.split("\n");

	    for (var i in lines) {
		var s = document.createElement("span");
		if (!className) {
		    className = "white";
		}
		s.className = "consoleText label-" + className;
		s.appendChild(document.createTextNode(lines[i]));
		e.appendChild(s);
		e.appendChild(document.createElement("br"));
	    }
	    e.scrollTop = e.scrollHeight;
	}
    };

    $scope.serverCommand = function(cmd) {
	if(cmd == "send") {
	    if($scope.pendingSend) {
		$scope.pendingSend = false;
		if($scope.sendText == "") {
		    $scope.consoleAppend("Missing text to send", "danger");
		    return;
		}
		cmd = cmd + "&arg1=" + $scope.sendText;
	    } else {
		$scope.pendingSend = true;
		return;
	    }
	}

	if($scope.pendingCmd != "") {
	    $scope.consoleAppend("Waiting for " + $scope.pendingCmd + " to complete.", "danger");
	    return;
	}

	$scope.pendingCmd = cmd;

	if(cmd != "status") {
	    var auth = "none";

	    if ($rootScope.authToken) {
		auth = $rootScope.authToken;
	    }

	    var proto = $location.protocol() == "https" ? 'wss://' : 'ws://';

	    $scope.ws_cmd = new WebSocket(proto + $location.host() + ':' + $location.port() + '/api/control?websocket=1&command=' + cmd + '&token=' + auth);

	    $scope.ws_cmd.onmessage = function (e) {
		var data = JSON.parse(e.data);

		if(data) {
		    var r = data.response;

		    if (r.status == "OK" || r.status == "CONTINUE") {
			$scope.consoleAppend(cmd + ">> " + r.output, "success");
		    } if (r.error) {
			$scope.consoleAppend(cmd + ">> ERROR: " + r.error_description, "danger");
		    }
		} else {
		    $scope.consoleAppend(cmd + ">> ERROR: UNEXPECTED RESPONSE FORMAT: " + e.data, "danger");
		}
	    };

	    $scope.ws_cmd.onclose = function () {
		$scope.pendingCmd = "";
		$scope.consoleAppend(cmd + ">> [Command Complete]", "success");
		var tmp_ws = $scope.ws_cmd;
		delete $scope.ws_cmd;
		tmp_ws.close();
	    };
	} else {
	    yodaApiService.serverCommand(cmd).then(function(data) {
		if (data.response.output) {
		    $scope.consoleAppend(cmd + ">> " + data.response.output.replace(/\n$/, ""), "success");
		} else {
		    $scope.consoleAppend(cmd + ">> ERROR: " + data.response.error_description, "danger");
		}
		$scope.pendingCmd = "";
		$scope.updateStatus();
	    }).catch(function() {
		$scope.consoleAppend(cmd + ">> ERROR: API Call Failure.", "danger");
		$scope.pendingCmd = "";
		$scope.updateStatus();
	    });
	}
    }

    if(!$scope.ws) {
        var auth = "none";

	if ($rootScope.authToken) {
	    auth = $rootScope.authToken;
	}

	var proto = $location.protocol() == "https" ? 'wss://' : 'ws://';

	$scope.ws = new WebSocket(proto + $location.host() + ':' + $location.port() + '/api/console?token=' + auth);

	$scope.ws.onmessage = function (e) {
	    var data = JSON.parse(e.data);

	    if(data) {
		var r = data.response;

		if ((r.channel = "SERVER_STATUS" && r.output != "") || (r.channel == "CONSOLE" && (r.status == "OK" || r.status == "CONTINUE"))) {
		    if (r.server_pid) {
			$scope.consoleAppend("Core3[" + r.server_pid + "]>> " + r.output);
		    } else {
			$scope.consoleAppend("Core3[not-running]>> " + r.output);
		    }
		}
		
		if (r.error) {
		    $scope.consoleAppend(">> ERROR: " + r.error_description, "danger");
		}

		if (r.server_status) {
		    $scope.server_status = r.server_status;
		    $scope.$apply();
		}
	    } else {
		$scope.consoleAppend(">> ERROR: UNEXPECTED RESPONSE FORMAT: " + e.data, "danger");
	    }
	};

	$scope.ws.onopen = function () {
	    $scope.consoleAppend("[Console channel connected to server]");
	};

	$scope.ws.onclose = function () {
	    $scope.consoleAppend("[Console channel closed by server]");
	    var tmp_ws = $scope.ws;
	    delete $scope.ws;
	    tmp_ws.close();
	};
    }

    $scope.updateStatus();

    yodaApiService.getConfig().then(function(data) {
	$scope.cfg = data.response.config;

	if (data.response.error) {
	    console.log($scope.messages);
	    $scope.autostart_server = false;
	} else {
	    if ($scope.cfg && $scope.cfg.yoda && $scope.cfg.yoda.flags && $scope.cfg.yoda.flags.autostart_server) {
		$scope.autostart_server = $scope.cfg.yoda.flags.autostart_server;
	    } else {
		$scope.autostart_server = false;
	    }
	}
    }).catch(function() {
	console.log("/api/config call failed");
    });
});

// Login Handling
emuYodaApp.service('loginModalService', function($rootScope, $uibModal, yodaApiService) {
    var openModal = function() {
	return $uibModal.open({
	    animation: true,
	    templateUrl: 'views/loginModalTemplate.html',
	    controller: 'loginModalController',
	    size: "sm"
	}).result.then(function(auth) {
	    $rootScope.currentUsername = auth.username;
	    yodaApiService.authenticateUser(auth.username, auth.password);
	    return auth.username;
	});
    };

    return {
	openModal: openModal
    };
})

emuYodaApp.controller('loginModalController', function ($scope, $uibModalInstance) {
    $scope.username = '';
    $scope.password = '';

    $scope.ok = function() {
	$uibModalInstance.close({ username: $scope.username, password: $scope.password });
    };

    $scope.cancel = function() {
	$uibModalInstance.dismiss('cancel');
    }
});

emuYodaApp.run(function ($rootScope, $state, $templateCache, $cacheFactory, loginModalService) {
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
	// TODO consider removing this cache dump at some point
	if (typeof (toState) !== 'undefined' && typeof (toState.templateUrl) == 'string') {
		$templateCache.remove(toState.templateUrl);
	}

	var requireLogin = toState.data.requireLogin;

	if (requireLogin && typeof $rootScope.currentUsername === 'undefined') {
	    event.preventDefault();

	    loginModalService.openModal().then(function () {
		return $state.go(toState.name, toParams);
	    }).catch(function () {
		return $state.go('home');
	    });
	}
    });
});

emuYodaApp.filter('timestampToString', [function () {
    return function(timestamp) {
	var ss = parseInt(timestamp, 10);
	var dd = Math.floor(ss / 86400);
	ss = ss - dd * 86400;
	var hh = Math.floor(ss / 3600);
	ss = ss - hh * 3600;
	var mm = Math.floor(ss / 60);
	ss = ss - mm * 60;

	var str = (hh < 10 ? "0"+hh : hh)
                  + ":"
                  + (mm < 10 ? "0"+mm : mm)
                  + ":"
                  + (ss < 10 ? "0"+ss : ss);

	if (dd > 0) {
	    str = dd + " days, " + str
	}

	return str
    };
}]);

emuYodaApp.directive('yodaNestedTable', function () {
    return {
	restrict: "A",
	replace: false,
	scope: {
	    object: '=yodaNestedTable'
	},
	template: "<yodanestedtablerow ng-repeat='(key, value) in object' key='key' value='value'></yodanestedtablerow>"
    }
})
.directive('yodanestedtablerow', function ($compile) {
    return {
	restrict: "E",
	replace: true,
	scope: {
	    key: '=',
	    value: '='
	},
	template: "<tr>",
	link: function (scope, element, attrs) {
	    var val = "{{ value }}"

	    if (angular.isObject(scope.value)) {
		val = "<table class='table table-striped table-hover' yoda-nested-table='value'>";
	    }

	    element.append("<td>{{ key }}:</td><td style='text-align:left;'>" + val + "</td></tr>");

	    $compile(element.contents())(scope);
	}
    }
});
