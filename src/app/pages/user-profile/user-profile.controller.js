/* @flow */
import Kefir from 'kefir';
import moment from 'moment';
import { update } from 'lodash';
import { slotNameToClassName } from '../../app.filter';
import type { UserLobbyData } from '../../shared/user.factory';

require('./user-profile.html');
require('./header.html');

angular
  .module('tf2stadium.controllers')
  .controller('UserProfileController', UserProfileController)
  .controller('UserProfileHeaderController', UserProfileHeaderController);

const {
  pub: updateProfileLoadingStatus,
  stream: profileLoadingStatus$,
} = (function () {
  var pubFn = ()=>{};

  function pub(x) {
    pubFn(x);
  }

  var stream = Kefir.stream(emitter => {
    pubFn = (x) => emitter.emit(x);
    return () => {};
  });

  return { pub, stream };
})();

const gameModes = [
  {key: 'playedSixesCount',
   abbr: '6s',
   name: '6v6'},
  {key: 'playedHighlanderCount',
   abbr: 'HL',
   name: 'Highlander' },
  {key: 'PlayedFoursCount',
   abbr: '4s',
   name: '4v4'},
  {key: 'PlayedBballCount',
   abbr: 'BBall',
   name: 'BasketBall'},
  {key: 'PlayedUltiduoCount',
   abbr: 'Ulti',
   name: 'Ultiduo'},
];

/** @ngInject */
function UserProfileController($state, User) {
  var vm = this;

  vm.steamId = $state.params.userID;
  vm.steamUrl = 'https://steamcommunity.com/profiles/' + vm.steamId;

  vm.profile = false;
  vm.loadingError = false;

  vm.lobbies = false;
  vm.lobbiesLoadingError = false;
  User
    .getLobbies(vm.steamId, 5)
    .then(function (lobbies: UserLobbyData) {
      vm.lobbies = lobbies.map(map => Object.assign({}, map, {
        createdAt: moment(map.createdAt),
        playerInfo: update(
          map.classes.map(function (klass) {
            if (klass.blu.filled && klass.blu.player && klass.blu.player.steamid === vm.steamId) {
              return { 'team': 'blu', 'class': klass.class };
            } else if (klass.red.filled && klass.red.player && klass.red.player.steamid === vm.steamId) {
              return { 'team': 'red', 'class': klass.class };
            }
            return false;
          }).find(x => x) || { team: '', 'class': '' },
          'class',
          slotNameToClassName
        ),
      }));
    }, (err) => vm.lobbiesLoadingError = err);

  updateProfileLoadingStatus(true);
  User
    .getProfile(vm.steamId)
    .then(function (profile) {
      updateProfileLoadingStatus(false);
      vm.profile = profile;
      vm.loadingError = false;

      vm.profile.createdAt = moment(vm.profile.createdAt);

      vm.profile.lobbyTypes = gameModes.map(o => (
        Object.assign({}, o, {cnt: vm.profile.stats[o.key]})
      ));

      vm.profile.classes = [
        'scout',
        'soldier',
        'pyro',
        'demoman',
        'heavy',
        'engineer',
        'medic',
        'sniper',
        'spy',
      ].map((className) => ({
        name: className,
        cnt: vm.profile.stats[className] || 0,
      }));

      vm.profile.external_links = [
        { name: 'tftv',
          img: '/assets/img/logos/tftv.png',
          description: 'TeamfortressTV'},
        { name: 'logstf',
          img: '/assets/img/logos/logstf.svg',
          description: 'Logs.TF'},
        { name: 'ugc',
          img: '/assets/img/logos/ugc.png',
          description: 'United Gaming Clans' },
        { name: 'etf2l',
          img: '/assets/img/logos/etf2l.png',
          description: 'European TF2 League' },
        { name: 'twitch',
          img: '/assets/img/logos/twitch-glitch.png',
          description: 'Twitch',
        },
      ].filter(function (l) {
        return vm.profile.external_links &&
          vm.profile.external_links.hasOwnProperty(l.name);
      }).map(l => Object.assign(
        {}, l, {url: vm.profile.external_links[l.name]}
      ));

      // TODO: TEST DATA, remove once the backend supplies this
      if (angular.isUndefined(vm.profile.stats.leaves)) {
        vm.profile.stats.leaves = 0;
      }

      vm.profile.stats.karma = vm.profile.stats.substitutes - vm.profile.stats.leaves;
    }, function (err) {
      vm.error = err;
      vm.loadingError = true;
    });
}

/** @ngInject */
function UserProfileHeaderController($scope, safeApply) {
  var vm = this;

  vm.showLoadingBar = false;
  function updateStatus(x) {
    safeApply($scope, () => vm.showLoadingBar = x);
  }

  profileLoadingStatus$.onValue(updateStatus);
  $scope.$on('$destroy', () => profileLoadingStatus$.offValue(updateStatus));
}
