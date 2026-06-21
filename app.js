function radio() {
  let hls = null;
  const YUNTING_KEY = 'f0fc4c668392f9f9a447e48584c214ee';

  return {
    currentSource: 'yunting',
    currentIndex: 0,
    isPlaying: false,
    sources: {
      radio: { stations: [], label: '电台文件' },
      yunting: { stations: [], label: '云听' }
    },
    sourceList: ['yunting', 'radio'],
    errorMsg: '',

    get stations() {
      return this.sources[this.currentSource].stations;
    },

    get currentStation() {
      return this.stations[this.currentIndex];
    },

    get channelCounterText() {
      if (this.stations.length === 0) return '0 / 0';
      return (this.currentIndex + 1) + ' / ' + this.stations.length;
    },

    get sourceLabel() {
      return this.sources[this.currentSource].label;
    },

    init() {
      this.fetchRadioStations();
      this.fetchYuntingStations();
      this.setupMediaSession();

      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); this.prevStation(); }
        if (e.code === 'ArrowRight') { e.preventDefault(); this.nextStation(); }
      });
    },

    destroyHls() {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      this.$refs.audio.removeAttribute('src');
    },

    showStations() {
      if (this.stations.length === 0) {
        this.errorMsg = '加载中...';
        return;
      }
      if (this.currentIndex >= this.stations.length) this.currentIndex = 0;
      this.loadStation(this.currentIndex);
    },

    loadStation(index) {
      this.destroyHls();
      this.errorMsg = '';
      if (index < 0 || index >= this.stations.length) return;

      this.currentIndex = index;
      var station = this.stations[index];
      var audio = this.$refs.audio;
      this.updateMediaSession();

      var url = station.url;
      if (url.indexOf('.m3u8') !== -1) {
        if (Hls.isSupported()) {
          hls = new Hls({
            fetchSetup: function(context, initParams) {
              return new Request(context.url, Object.assign({}, initParams, { mode: 'cors' }));
            }
          });
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (this.isPlaying) {
              audio.play().catch((e) => {
                if (e.name === 'AbortError') return;
                this.errorMsg = '播放失败: ' + e.message;
                this.isPlaying = false;
              });
            }
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              this.errorMsg = '流加载错误';
              this.isPlaying = false;
            }
          });
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = url;
          if (this.isPlaying) {
            audio.play().catch((e) => {
              if (e.name === 'AbortError') return;
              this.errorMsg = '播放失败';
              this.isPlaying = false;
            });
          }
        } else {
          this.errorMsg = '浏览器不支持 HLS 流';
          this.isPlaying = false;
        }
      } else {
        audio.src = url;
        if (this.isPlaying) {
          audio.play().catch((e) => {
            if (e.name === 'AbortError') return;
            this.errorMsg = '播放失败: ' + e.message;
            this.isPlaying = false;
          });
        }
      }
    },

    togglePlay() {
      if (this.stations.length === 0) return;
      var audio = this.$refs.audio;
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.loadStation(this.currentIndex);
      } else {
        this.isPlaying = false;
        audio.pause();
      }
      this.updatePlaybackState();
    },

    prevStation() {
      if (this.stations.length === 0) return;
      var audio = this.$refs.audio;
      var wasPlaying = this.isPlaying;
      if (this.isPlaying) { this.isPlaying = false; audio.pause(); }
      this.currentIndex = (this.currentIndex - 1 + this.stations.length) % this.stations.length;
      this.isPlaying = wasPlaying;
      this.loadStation(this.currentIndex);
    },

    nextStation() {
      if (this.stations.length === 0) return;
      var audio = this.$refs.audio;
      var wasPlaying = this.isPlaying;
      if (this.isPlaying) { this.isPlaying = false; audio.pause(); }
      this.currentIndex = (this.currentIndex + 1) % this.stations.length;
      this.isPlaying = wasPlaying;
      this.loadStation(this.currentIndex);
    },

    updatePlaybackState() {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
      }
    },

    updateMediaSession() {
      if (!('mediaSession' in navigator)) return;
      var station = this.currentStation;
      if (!station) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: station.name,
        artist: '晶体管收音机',
        artwork: [
          { src: '/static/img/icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      });
    },

    setupMediaSession() {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('play', () => {
        if (!this.isPlaying) {
          this.isPlaying = true;
          this.loadStation(this.currentIndex);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.isPlaying) {
          this.isPlaying = false;
          this.$refs.audio.pause();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prevStation();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.nextStation();
      });
    },

    signParams(params) {
      var keys = Object.keys(params).sort();
      var str = keys.map(function(k) { return k + '=' + params[k]; }).join('&');
      var ts = Date.now();
      str += '&timestamp=' + ts + '&key=' + YUNTING_KEY;
      return { timestamp: ts, sign: CryptoJS.MD5(str).toString().toUpperCase() };
    },

    fetchYuntingStations() {
      var params = { categoryId: 0, provinceCode: 0 };
      var sig = this.signParams(params);
      var qs = Object.keys(params).map(function(k) { return k + '=' + params[k]; }).join('&');
      var url = 'https://ytmsout.radio.cn/web/appBroadcast/list?' + qs;

      fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'equipmentId': '0000',
          'platformCode': 'WEB',
          'timestamp': sig.timestamp,
          'sign': sig.sign
        }
      })
      .then(function(res) { return res.json(); })
      .then((json) => {
        if (json.code !== 0) {
          if (this.currentSource === 'yunting') this.errorMsg = '云听加载失败: ' + (json.message || '');
          return;
        }
        this.sources.yunting.stations = json.data.map(function(item) {
          return { name: item.title, url: item.mp3PlayUrlHigh.replace('http://', 'https://'), image: item.image, subtitle: item.subtitle };
        });
        if (this.currentSource === 'yunting') this.showStations();
      })
      .catch((err) => {
        if (this.currentSource === 'yunting') this.errorMsg = '云听加载失败: ' + err.message;
      });
    },

    fetchRadioStations() {
      fetch('radio.json')
        .then(function(res) {
          if (!res.ok) throw new Error('无法加载 radio.json');
          return res.json();
        })
        .then((data) => {
          this.sources.radio.stations = data.map(function(item) {
            return { name: item.name, url: item.url, image: item.logo || '' };
          });
          if (this.currentSource === 'radio') this.showStations();
        })
        .catch((err) => {
          if (this.currentSource === 'radio') this.errorMsg = '加载频道列表失败: ' + err.message;
        });
    },

    switchSource() {
      var nextIdx = (this.sourceList.indexOf(this.currentSource) + 1) % this.sourceList.length;
      var next = this.sourceList[nextIdx];
      var audio = this.$refs.audio;
      if (this.isPlaying) {
        this.isPlaying = false;
        audio.pause();
      }
      this.destroyHls();
      this.errorMsg = '';
      this.currentSource = next;
      this.currentIndex = 0;
      this.showStations();
    }
  };
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function(err) {
    console.warn('Service Worker 注册失败:', err);
  });
}
