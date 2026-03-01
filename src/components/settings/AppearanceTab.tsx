import type { AppConfig, PoseConfig, AnimationConfig, CameraConfig } from "../../lib/config";
import { DEFAULT_POSE, DEFAULT_ANIMATION, DEFAULT_CAMERA } from "../../lib/config";

interface Props {
  config: AppConfig;
  updateConfig: (patch: Partial<AppConfig>) => void;
}

export default function AppearanceTab({ config, updateConfig }: Props) {
  const pose = config.pose ?? DEFAULT_POSE;
  const anim = config.animation ?? DEFAULT_ANIMATION;
  const cam = config.camera ?? DEFAULT_CAMERA;

  const updatePose = (patch: Partial<PoseConfig>) => {
    updateConfig({ pose: { ...pose, ...patch } });
  };
  const updateAnim = (patch: Partial<AnimationConfig>) => {
    updateConfig({ animation: { ...anim, ...patch } });
  };
  const updateCam = (patch: Partial<CameraConfig>) => {
    updateConfig({ camera: { ...cam, ...patch } });
  };

  return (
    <div className="tab-content">
      <h2>外观设置</h2>
      <p className="tab-desc">Window, character, pose, animation, and camera settings.</p>

      {/* ── Window ── */}
      <h3 className="section-title">🪟 窗口</h3>

      <div className="form-group">
        <label>Window Width: {config.windowWidth}px</label>
        <input
          type="range"
          min={200} max={800} step={10}
          value={config.windowWidth}
          onChange={(e) => {
            const w = Number(e.target.value);
            updateConfig({ windowWidth: w, windowHeight: Math.round(w * 1.5) });
          }}
        />
        <div className="range-labels"><span>200px</span><span>800px</span></div>
      </div>

      <div className="form-group">
        <label>Opacity: {Math.round(config.opacity * 100)}%</label>
        <input
          type="range"
          min={30} max={100} step={5}
          value={config.opacity * 100}
          onChange={(e) => updateConfig({ opacity: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>30%</span><span>100%</span></div>
      </div>

      <div className="form-group">
        <label>Character Scale: {config.characterScale.toFixed(1)}x</label>
        <input
          type="range"
          min={50} max={200} step={10}
          value={config.characterScale * 100}
          onChange={(e) => updateConfig({ characterScale: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>0.5x</span><span>2.0x</span></div>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.alwaysOnTop}
            onChange={(e) => updateConfig({ alwaysOnTop: e.target.checked })}
          />
          Always on Top
        </label>
      </div>

      {/* ── Pose ── */}
      <h3 className="section-title">🦴 姿势</h3>

      <div className="form-group">
        <label>手臂下垂: {pose.armDown}°</label>
        <input
          type="range"
          min={0} max={90} step={1}
          value={pose.armDown}
          onChange={(e) => updatePose({ armDown: Number(e.target.value) })}
        />
        <div className="range-labels"><span>0° (T-pose)</span><span>90° (贴身)</span></div>
      </div>

      <div className="form-group">
        <label>肘部弯曲: {pose.elbowBend}°</label>
        <input
          type="range"
          min={0} max={90} step={1}
          value={pose.elbowBend}
          onChange={(e) => updatePose({ elbowBend: Number(e.target.value) })}
        />
        <div className="range-labels"><span>0° (伸直)</span><span>90° (大弯)</span></div>
      </div>

      <div className="form-group">
        <button
          className="btn-reset"
          onClick={() => updateConfig({ pose: { ...DEFAULT_POSE } })}
        >
          ↺ 重置姿势
        </button>
      </div>

      {/* ── Animation ── */}
      <h3 className="section-title">✨ 动画</h3>

      <div className="form-group">
        <label>呼吸幅度: {anim.breathingIntensity}%</label>
        <input
          type="range"
          min={0} max={100} step={5}
          value={anim.breathingIntensity}
          onChange={(e) => updateAnim({ breathingIntensity: Number(e.target.value) })}
        />
        <div className="range-labels"><span>0 (静止)</span><span>100 (夸张)</span></div>
      </div>

      <div className="form-group">
        <label>头部摇摆: {anim.headSwayIntensity}%</label>
        <input
          type="range"
          min={0} max={100} step={5}
          value={anim.headSwayIntensity}
          onChange={(e) => updateAnim({ headSwayIntensity: Number(e.target.value) })}
        />
        <div className="range-labels"><span>0 (静止)</span><span>100 (大摆)</span></div>
      </div>

      <div className="form-group">
        <label>动画速度: {anim.animationSpeed.toFixed(1)}x</label>
        <input
          type="range"
          min={10} max={300} step={10}
          value={anim.animationSpeed * 100}
          onChange={(e) => updateAnim({ animationSpeed: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>0.1x</span><span>3.0x</span></div>
      </div>

      <div className="form-group">
        <button
          className="btn-reset"
          onClick={() => updateConfig({ animation: { ...DEFAULT_ANIMATION } })}
        >
          ↺ 重置动画
        </button>
      </div>

      {/* ── Camera ── */}
      <h3 className="section-title">📷 镜头</h3>

      <div className="form-group">
        <label>FOV: {cam.fov}°</label>
        <input
          type="range"
          min={15} max={60} step={1}
          value={cam.fov}
          onChange={(e) => updateCam({ fov: Number(e.target.value) })}
        />
        <div className="range-labels"><span>15° (长焦)</span><span>60° (广角)</span></div>
      </div>

      <div className="form-group">
        <label>镜头高度: {cam.cameraHeight.toFixed(2)}</label>
        <input
          type="range"
          min={50} max={200} step={5}
          value={cam.cameraHeight * 100}
          onChange={(e) => updateCam({ cameraHeight: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>0.5</span><span>2.0</span></div>
      </div>

      <div className="form-group">
        <label>镜头距离: {cam.cameraDistance.toFixed(1)}</label>
        <input
          type="range"
          min={10} max={60} step={1}
          value={cam.cameraDistance * 10}
          onChange={(e) => updateCam({ cameraDistance: Number(e.target.value) / 10 })}
        />
        <div className="range-labels"><span>1.0 (近)</span><span>6.0 (远)</span></div>
      </div>

      <div className="form-group">
        <label>注视高度: {cam.lookAtHeight.toFixed(2)}</label>
        <input
          type="range"
          min={50} max={200} step={5}
          value={cam.lookAtHeight * 100}
          onChange={(e) => updateCam({ lookAtHeight: Number(e.target.value) / 100 })}
        />
        <div className="range-labels"><span>0.5</span><span>2.0</span></div>
      </div>

      <div className="form-group">
        <button
          className="btn-reset"
          onClick={() => updateConfig({ camera: { ...DEFAULT_CAMERA } })}
        >
          ↺ 重置镜头
        </button>
      </div>
    </div>
  );
}
