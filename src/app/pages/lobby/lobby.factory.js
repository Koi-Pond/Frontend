(function () {
  'use strict';

  angular.module('tf2stadium.services')
    .factory('LobbyService', LobbyService);

  /** @ngInject */
  function LobbyService($rootScope, $state, $mdDialog, $timeout, $interval,
                        $window, Websocket, Notifications, Settings) {
    var factory = {};

    factory.lobbyList = [];

    factory.lobbySpectated = Object.create(null);
    factory.lobbyJoined = Object.create(null);

    factory.lobbySpectatedId = -1;
    factory.lobbyJoinedId = -1;

    factory.subList = [];
    factory.lobbyJoinInformation = {};

    var playerPreReady = false;
    var preReadyUpTimer = 0;
    var preReadyUpInterval;

    factory.getLobbyJoinInformation = function () {
      return factory.lobbyJoinInformation;
    };

    factory.getSubList = function () {
      return factory.subList;
    };

    factory.getList = function () {
      return factory.lobbyList;
    };

    // Will return undefined when a lobby is not currently being
    // spectated
    factory.getLobbySpectated = function () {
      return factory.lobbySpectated;
    };

    // Will return -1 when a lobby is not currently being
    // spectated
    factory.getLobbySpectatedId = function () {
      return factory.lobbySpectatedId;
    };

    factory.leaveSpectatedLobby = function () {
      if (factory.lobbySpectatedId === -1) {
        return;
      }
      Websocket.emitJSON('lobbySpectatorLeave', {id: factory.lobbySpectatedId}, function () {
        factory.lobbySpectatedId = -1;
        factory.lobbySpectated = {};
        $rootScope.$emit('lobby-spectated-changed');
        $rootScope.$emit('lobby-spectated-updated');
      });
    };

    // Will return undefined when not currently joined in any
    // lobby
    factory.getLobbyJoined = function () {
      return factory.lobbyJoined;
    };

    // Will return -1 when not currently joined in any
    // lobby
    factory.getLobbyJoinedId = function () {
      return factory.lobbyJoinedId;
    };

    factory.getPlayerPreReady = function () {
      return playerPreReady;
    };

    factory.setPlayerPreReady = function (isReady) {
      playerPreReady = isReady;

      if (!playerPreReady) {
        $interval.cancel(preReadyUpInterval);
        return;
      }

      preReadyUpTimer = 180;
      $interval.cancel(preReadyUpInterval);

      preReadyUpInterval = $interval(function () {
        preReadyUpTimer--;

        if (preReadyUpTimer <= 0) {
          playerPreReady = false;
          $interval.cancel(preReadyUpInterval);
        }
      }, 1000);
    };

    factory.getPreReadyUpTimer = function () {
      return preReadyUpTimer;
    };

    factory.subscribe = function (request, scope, callback) {
      var handler = $rootScope.$on(request, callback);
      scope.$on('$destroy', handler);
    };

    factory.kick = function (lobbyID, steamID) {
      var payload = {
        'id': lobbyID,
        'steamid': steamID
      };

      Websocket.emitJSON('lobbyKick', payload, function (response) {
        if (response.success) {
          Notifications.toast({message: 'Player kicked'});
        }
      });
    };

    factory.ban = function (lobbyID, steamID) {
      var payload = {
        'id': lobbyID,
        'steamid': steamID
      };

      Websocket.emitJSON('lobbyBan', payload, function (response) {
        if (response.success) {
          Notifications.toast({message: 'Player banned'});
        }
      });
    };

    factory.join = function (lobbyID, team, position, password) {
      var payload = {
        'id': lobbyID,
        'team': team,
        'class': position,
        'password': password
      };

      Websocket.emitJSON('lobbyJoin', payload);
    };

    factory.leaveSlot = function (lobbyID) {
      var payload = {
        'id': lobbyID
      };

      Websocket.emitJSON('lobbyLeave', payload);
    };

    factory.goToLobby = function (lobby) {
      $state.go('lobby-page', {lobbyID: lobby});
    };

    factory.spectate = function (lobby) {
      Websocket.emitJSON('lobbySpectatorJoin', {id: lobby}, function (response) {
        if (response.success) {
          /*
          This code assumes that the only way we'll ever spectate
          a lobby is when we asked the backend to let us do it.

          However, the backend might have some ideas of its own and
          force us to spectate a lobby (for example, on websocket connection).

          This code needs to be moved to the lobbyData handler, but the backend
          is sending us bogus lobbyData on lobbyJoin that makes the page stutter,
          so it stays here for the moment.
          */
          var oldLobbyId = factory.lobbySpectatedId;
          factory.lobbySpectatedId = lobby;

          if (lobby !== oldLobbyId) {
            $rootScope.$emit('lobby-spectated-changed');
          }
          $rootScope.$emit('lobby-spectated-updated');
        }
      });
    };

    factory.closeLobby = function (lobbyID) {
      Websocket.emitJSON('lobbyClose', {id: lobbyID});
    };

    factory.resetServer = function (lobbyID) {
      Websocket.emitJSON('lobbyServerReset', {id: lobbyID});
    };

    factory.setLobbyLeader = function (lobbyId, steamId) {
      Websocket.emitJSON('lobbyChangeOwner',
                         {id: lobbyId,
                          steamid: steamId});
    };

    factory.setSlotRequirement = function (lobbyId, slotId, reqName, val) {
      Websocket.emitJSON('lobbySetRequirement', {
        id: lobbyId,
        slot: slotId,
        type: reqName,
        value: val || 0
      });
    };

    Websocket.onJSON('lobbyReadyUp', function () {
      $rootScope.$emit('lobby-ready-up');
      if (playerPreReady) {
        Websocket.emitJSON('playerReady', {});
        return;
      }
      $mdDialog.show({
        templateUrl: 'app/shared/notifications/ready-up.html',
        controller: 'ReadyUpDialogController',
        controllerAs: 'dialog',
        locals: {
          timeout: 30
        },
        bindToController: true
      }).then(function (response) {
        if (response.readyUp) {
          Websocket.emitJSON('playerReady', {});
          localStorage.setItem('tabCommunication', '');
          localStorage.setItem('tabCommunication', 'closeDialog');
        }
      }, function () {
        Websocket.emitJSON('playerNotReady', {});
        localStorage.setItem('tabCommunication', '');
        localStorage.setItem('tabCommunication', 'closeDialog');
      });
      Settings.getSettings(function (settings) {
        Notifications.notifyBrowser({
          title: 'Click here to ready up!',
          body: 'All the slots are filled, ready up to start',
          soundFile: '/assets/sound/lobby-readyup.wav',
          soundVolume: settings.soundVolume * 0.01,
          timeout: 30,
          callbacks: {
            onclick: function () {
              $window.focus();
            }
          }
        });
      });
    });

    Websocket.onJSON('lobbyStart', function (data) {
      factory.lobbyJoinInformation = data;

      if (data.game) {
        factory.lobbyJoinInformation.connectUrl = 'steam://connect/' +
          data.game.host + '/' + data.password;

        factory.lobbyJoinInformation.connectString =
          'connect ' + data.game.host + '; password ' + data.password;
      }

      factory.lobbyJoinInformation.mumbleUrl = 'mumble://' +
        'unnamed' + ':' + data.mumble.password + '@' +
        data.mumble.address + '/' +
        encodeURIComponent(data.mumble.channel).replace('%2F', '/') +
        '/?version=1.2.0&title=TF2Stadium&url=tf2stadium.com';

      $rootScope.$emit('lobby-start');
      Notifications.toast({
        message: 'Your lobby has started!',
        actionMessage: 'Go back',
        action: function () {
          factory.goToLobby(factory.lobbyJoinedId);
        }
      });
      Settings.getSettings(function (settings) {
        Notifications.notifyBrowser({
          title: 'Lobby is starting!',
          body: 'Come back to the site to join the server',
          soundFile: '/assets/sound/lobby-start.wav',
          soundVolume: settings.soundVolume * 0.01,
          timeout: 5,
          callbacks: {
            onclick: function () {
              $window.focus();
            }
          }
        });
      });
    });

    Websocket.onJSON('subListData', function (data) {
      factory.subList = data;
      $rootScope.$emit('sub-list-updated');
    });

    Websocket.onJSON('lobbyListData', function (data) {
      if (angular.isArray(data)) {
        factory.lobbyList = data;
      } else {
        factory.lobbyList = data.lobbies;
      }

      $rootScope.$emit('lobby-list-updated');

      if (factory.lobbyJoinedId === -1) {
        return;
      }

      factory.lobbyList.forEach(function (lobby) {
        if (lobby.id === factory.lobbyJoinedId) {
          factory.getLobbyJoined().players = lobby.players;
          factory.getLobbyJoined().maxPlayers = lobby.maxPlayers;
        }
      });
      $rootScope.$emit('lobby-joined-updated');
    });

    Websocket.onJSON('lobbyData', function (newLobby) {
      factory.lobbySpectated = newLobby;

      if (newLobby.id === factory.lobbySpectatedId) {
        $rootScope.$emit('lobby-spectated-updated');
      }

      if (newLobby.id === factory.lobbyJoinedId) {
        $rootScope.$emit('lobby-joined-updated');
      }
    });

    Websocket.onJSON('lobbyJoined', function (data) {
      factory.lobbyJoinedId = data.id;
      factory.lobbyJoined = data;
      factory.setPlayerPreReady(true);
      $rootScope.$emit('lobby-joined');
      $rootScope.$emit('lobby-joined-updated');
    });

    Websocket.onJSON('lobbyLeft', function () {
      factory.lobbyJoinedId = -1;
      factory.lobbyJoined = {};
      factory.lobbyJoinInformation = {};
      factory.setPlayerPreReady(false);
      $rootScope.$emit('lobby-joined-updated');
      $rootScope.$emit('lobby-left');
    });

    Websocket.onJSON('lobbyClosed', function () {
      Notifications.toast({message: 'The lobby was closed'});
      $rootScope.$emit('lobby-closed');
    });

    return factory;
  }

})();
