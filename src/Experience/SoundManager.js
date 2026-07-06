import * as THREE from 'three';

export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.listener = new THREE.AudioListener();
        this.audioLoader = new THREE.AudioLoader();

        // ── Only 3 sounds total, as requested ───────────────────
        // 1) hallEntry   - single one-shot sound, plays once on first click.
        // 2) ballSound   - ONE file/ONE variable used for both the launch
        //    and the rolling loop. It starts playing (looped) the moment
        //    the ball launches, and stops when the throw ends.
        // 3) pinFall     - the single sound used for ball-pin hits,
        //    pin-pin hits, AND a pin actually falling — all merged into
        //    this one sound, triggered only at the moment a pin's state
        //    flips to "fallen" (see Collisions.js). It's POOLED (several
        //    THREE.Audio instances sharing one buffer) so that if several
        //    pins fall within the same instant, each one is still audible
        //    instead of cutting the previous one off.
        this.sounds = {
            hallEntry: null,
            ballSound: null,
        };
        this.pools = {}; // key -> { instances: THREE.Audio[], nextIndex }

        this.isBallSoundPlaying = false;
        this.masterVolume = 0.7;

        this._initializeSounds();
        this._setupAutoplayUnlock();
    }

    _initializeSounds() {
        // 1) Hall entry - single, one-shot
        this.sounds.hallEntry = new THREE.Audio(this.listener);
        this._loadAudio(this.sounds.hallEntry, '/sounds/49510__jgrzinich__entry-hall-of-tate-modern.wav', {
            volume: 0.5,
            loop: false,
        });

        // 2) Ball launch + rolling merged into ONE looping sound.
        // Kept quieter than the pin-fall sound (see pool volume below)
        // so it never masks the pin sound when both play at once.
        this.sounds.ballSound = new THREE.Audio(this.listener);
        this._loadAudio(this.sounds.ballSound, '/sounds/128969__driftworks__bowling-ball.wav', {
            volume: 0.35,
            loop: true,
        });

        // 3) Pin fall — the ONE sound for ball-pin hit / pin-pin hit /
        // pin falling, all merged. Pooled so overlapping falls don't cut
        // each other off.
        this._createPool('pinFall', '/sounds/514385__sieuamthanh__bowling-strike.wav', {
            volume: 0.75,
            poolSize: 6,
        });
    }

    // ─────────────────────────────────────────────────────────
    // Loading helpers
    // ─────────────────────────────────────────────────────────

    _loadAudio(audioObject, url, options = {}) {
        this.audioLoader.load(
            url,
            (audioBuffer) => {
                audioObject.setBuffer(audioBuffer);
                if (options.volume !== undefined) audioObject.setVolume(options.volume * this.masterVolume);
                if (options.loop !== undefined) audioObject.loop = options.loop;
                if (options.playbackRate !== undefined) audioObject.playbackRate = options.playbackRate;
            },
            undefined,
            (error) => {
                console.warn(`Failed to load audio: ${url}`, error);
            }
        );
    }

    // Creates `poolSize` THREE.Audio nodes sharing the same decoded buffer
    // (decoding happens once, not once per instance).
    _createPool(key, url, { volume = 1, poolSize = 4 } = {}) {
        const instances = [];
        for (let i = 0; i < poolSize; i++) {
            instances.push(new THREE.Audio(this.listener));
        }
        this.pools[key] = { instances, nextIndex: 0, baseVolume: volume };

        this.audioLoader.load(
            url,
            (audioBuffer) => {
                instances.forEach((audio) => audio.setBuffer(audioBuffer));
            },
            undefined,
            (error) => {
                console.warn(`Failed to load audio: ${url}`, error);
            }
        );
    }

    // Picks the next free (not currently playing) instance in the pool.
    // If every voice is busy, reuse the oldest one (round robin) instead
    // of silently dropping the sound.
    _playFromPool(key, { volume = 1, playbackRate = 1 } = {}) {
        const pool = this.pools[key];
        if (!pool) return;

        const { instances } = pool;
        if (!instances.length || !instances[0].buffer) {
            console.warn(`Sound pool "${key}" not loaded yet`);
            return;
        }

        let audio = instances.find((a) => !a.isPlaying);
        if (!audio) {
            audio = instances[pool.nextIndex];
            pool.nextIndex = (pool.nextIndex + 1) % instances.length;
            if (audio.isPlaying) audio.stop();
        }

        audio.setVolume(volume * this.masterVolume);
        audio.playbackRate = playbackRate;
        audio.play();
    }

    // Some browsers keep the WebAudio context "suspended" until a real
    // user gesture happens. If it stays suspended, .play() succeeds
    // silently — no error, no sound. This nudges it awake on first
    // interaction just in case.
    _setupAutoplayUnlock() {
        const resume = () => {
            const ctx = this.listener.context;
            if (ctx.state === 'suspended') ctx.resume();
        };
        window.addEventListener('click', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
    }

    // ─────────────────────────────────────────────────────────
    // تشغيل الأصوات (٣ أصوات بس)
    // ─────────────────────────────────────────────────────────

    playHallEntry() {
        if (!this.sounds.hallEntry || !this.sounds.hallEntry.buffer) {
            console.warn('Hall entry sound not loaded');
            return;
        }
        if (this.sounds.hallEntry.isPlaying) this.sounds.hallEntry.stop();
        this.sounds.hallEntry.play();
        console.log('🎵 Hall entry sound played');
    }

    // Call this ONCE when the ball is launched. It plays the single
    // ball file on loop until stopBallSound() is called (throw ends).
    playBallSound() {
        if (!this.sounds.ballSound || !this.sounds.ballSound.buffer) {
            console.warn('Ball sound not loaded');
            return;
        }
        if (this.isBallSoundPlaying) return; // don't restart if already going

        this.isBallSoundPlaying = true;
        if (this.sounds.ballSound.isPlaying) this.sounds.ballSound.stop();
        this.sounds.ballSound.play();
        console.log('🎵 Ball sound started (launch + rolling)');
    }

    stopBallSound() {
        if (!this.isBallSoundPlaying) return;

        this.isBallSoundPlaying = false;
        if (this.sounds.ballSound && this.sounds.ballSound.isPlaying) {
            this.sounds.ballSound.stop();
        }
        console.log('⏹️ Ball sound stopped');
    }

    // The ONE merged sound for: ball hitting a pin, a pin hitting another
    // pin, and a pin falling. Call this exactly once per pin that falls
    // (see Collisions.js — triggered on the isFallen transition, not on
    // every collision tick).
    playPinFall() {
        const pitchVariation = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
        this._playFromPool('pinFall', { volume: 0.75, playbackRate: pitchVariation });
        console.log('🎵 Pin fall sound played');
    }

    // ─────────────────────────────────────────────────────────
    // التحكم بالصوت
    // ─────────────────────────────────────────────────────────

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        console.log(`🔊 Master volume: ${(this.masterVolume * 100).toFixed(0)}%`);
    }

    muteAll() {
        Object.values(this.sounds).forEach((sound) => {
            if (sound && sound.isPlaying) sound.stop();
        });
        Object.values(this.pools).forEach((pool) => {
            pool.instances.forEach((sound) => {
                if (sound.isPlaying) sound.stop();
            });
        });
        this.isBallSoundPlaying = false;
        console.log('🔇 All sounds muted');
    }

    getListener() {
        return this.listener;
    }

    // For debugging
    checkLoadedSounds() {
        const loadedSingles = Object.entries(this.sounds)
            .filter(([, sound]) => sound && sound.buffer)
            .map(([key]) => key);
        const loadedPools = Object.entries(this.pools)
            .filter(([, pool]) => pool.instances[0] && pool.instances[0].buffer)
            .map(([key]) => key);

        console.log('✅ Loaded sounds:', [...loadedSingles, ...loadedPools]);
        console.log('❌ Missing sounds:', [
            ...Object.keys(this.sounds).filter((key) => !this.sounds[key]?.buffer),
            ...Object.keys(this.pools).filter((key) => !this.pools[key].instances[0]?.buffer),
        ]);
    }
}