/**
 * MaintenanceMode - 维修模式悬浮层
 * 允许用户通过语音或文字修改 System Prompt 和 Tool 描述
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SceneOverrides,
  ToolInfo,
  MaintenanceStep,
  getSceneOverrides,
  appendPrompt,
  setToolOverride,
  resetSceneOverrides,
  removePromptAddition,
  removeToolOverride,
  speechToText,
  parseInstruction,
} from '../../sdk';

interface MaintenanceModeProps {
  sceneId: string;
  sceneName: string;
  currentPrompt: string;
  tools: ToolInfo[];
  onClose: (hasChanges: boolean) => void;
}

export function MaintenanceMode({
  sceneId,
  sceneName,
  currentPrompt,
  tools,
  onClose,
}: MaintenanceModeProps) {
  const [step, setStep] = useState<MaintenanceStep>('idle');
  const [overrides, setOverrides] = useState<SceneOverrides | null>(null);
  const [textInput, setTextInput] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const existing = getSceneOverrides(sceneId);
    setOverrides(existing);
  }, [sceneId]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setStep('transcribing');

        const result = await speechToText(audioBlob);
        if (result.success && result.text) {
          setTranscribedText(result.text);
          setStep('confirming');
        } else {
          setError(result.error || '语音识别失败');
          setStep('idle');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setStep('recording');
    } catch (err: any) {
      setError('无法访问麦克风');
      setStep('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const confirmTranscription = useCallback(async () => {
    setStep('parsing');
    setError(null);

    const currentTools: ToolInfo[] = tools.map(t => ({
      name: t.name,
      description: overrides?.toolOverrides[t.name]?.description || t.description,
    }));

    const result = await parseInstruction(transcribedText, currentPrompt, currentTools);

    if (result.success) {
      if (result.action === 'cancel') {
        setStep('idle');
        setTranscribedText('');
      } else {
        setParseResult(result);
        setStep('previewing');
      }
    } else {
      setError(result.error || '解析失败');
      setStep('confirming');
    }
  }, [transcribedText, currentPrompt, tools, overrides]);

  const applyChange = useCallback(() => {
    if (!parseResult) return;

    let newOverrides: SceneOverrides | null = null;

    if (parseResult.action === 'append_prompt' && parseResult.content) {
      newOverrides = appendPrompt(sceneId, parseResult.content);
    } else if (parseResult.action === 'modify_tool' && parseResult.toolName && parseResult.newDescription) {
      newOverrides = setToolOverride(sceneId, parseResult.toolName, {
        description: parseResult.newDescription,
      });
    }

    if (newOverrides) {
      setOverrides(newOverrides);
      setHasChanges(true);
    }

    setStep('saved');
    setTimeout(() => {
      setStep('idle');
      setTranscribedText('');
      setParseResult(null);
    }, 1500);
  }, [parseResult, sceneId]);

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;

    setTranscribedText(textInput);
    setTextInput('');
    setStep('parsing');
    setError(null);

    const currentTools: ToolInfo[] = tools.map(t => ({
      name: t.name,
      description: overrides?.toolOverrides[t.name]?.description || t.description,
    }));

    const result = await parseInstruction(textInput, currentPrompt, currentTools);

    if (result.success) {
      if (result.action === 'cancel') {
        setStep('idle');
      } else {
        setParseResult(result);
        setStep('previewing');
      }
    } else {
      setError(result.error || '解析失败');
      setStep('idle');
    }
  }, [textInput, currentPrompt, tools, overrides]);

  const handleReset = useCallback(() => {
    if (window.confirm('确定要恢复默认配置吗？')) {
      resetSceneOverrides(sceneId);
      setOverrides(null);
      setHasChanges(true);
    }
  }, [sceneId]);

  const handleRemovePrompt = useCallback((index: number) => {
    const newOverrides = removePromptAddition(sceneId, index);
    setOverrides(newOverrides);
    setHasChanges(true);
  }, [sceneId]);

  const handleRemoveToolOverride = useCallback((toolName: string) => {
    const newOverrides = removeToolOverride(sceneId, toolName);
    setOverrides(newOverrides);
    setHasChanges(true);
  }, [sceneId]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-600/50 shadow-2xl">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <h2 className="text-lg font-bold text-white">维修模式</h2>
              <p className="text-sm text-slate-400">{sceneName}</p>
            </div>
          </div>
          <button
            onClick={() => onClose(hasChanges)}
            className="p-2 rounded-lg bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* System Prompt 区域 */}
          <section className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span>📝</span> System Prompt
            </h3>
            <div className="text-sm text-slate-400 max-h-32 overflow-y-auto whitespace-pre-wrap bg-slate-800/50 rounded-lg p-3">
              {currentPrompt || '(无)'}
            </div>

            {overrides && overrides.promptAdditions.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-emerald-400 font-medium">✏️ 已追加：</p>
                {overrides.promptAdditions.map((addition, index) => (
                  <div key={index} className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <span className="flex-1 text-sm text-emerald-300">{addition}</span>
                    <button onClick={() => handleRemovePrompt(index)} className="text-red-400 hover:text-red-300 text-xs">删除</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tools 列表 */}
          <section className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span>🛠️</span> Tools ({tools.length}个)
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tools.map((tool) => {
                const hasOverride = overrides?.toolOverrides[tool.name];
                const isExpanded = expandedTool === tool.name;

                return (
                  <div key={tool.name} className={`rounded-lg border transition-all ${hasOverride ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800/50 border-slate-600/30'}`}>
                    <button onClick={() => setExpandedTool(isExpanded ? null : tool.name)} className="w-full flex items-center justify-between p-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">▸</span>
                        <span className="text-sm font-mono text-slate-200">{tool.name}</span>
                        {hasOverride && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">已修改</span>}
                      </div>
                      <svg className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-slate-600/30 pt-2">
                        <p className="text-xs text-slate-500 mb-1">原始描述：</p>
                        <p className="text-sm text-slate-400">{tool.description || '(无)'}</p>
                        {hasOverride && (
                          <>
                            <p className="text-xs text-amber-400 mt-2 mb-1">修改后：</p>
                            <p className="text-sm text-amber-300">{hasOverride.description}</p>
                            <button onClick={() => handleRemoveToolOverride(tool.name)} className="mt-2 text-xs text-red-400 hover:text-red-300">恢复原始</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 输入区域 */}
          <section className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span>🎤</span> 语音/文字输入
            </h3>

            {step === 'recording' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400">正在录音...</span>
                <button onClick={stopRecording} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors">停止录音</button>
              </div>
            )}

            {step === 'transcribing' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-blue-400">正在识别语音...</span>
              </div>
            )}

            {step === 'confirming' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">识别结果：</p>
                  <p className="text-slate-200">{transcribedText}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={confirmTranscription} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">确认</button>
                  <button onClick={() => { setStep('idle'); setTranscribedText(''); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">重新说</button>
                </div>
              </div>
            )}

            {step === 'parsing' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-purple-400">AI 正在解析指令...</span>
              </div>
            )}

            {step === 'previewing' && parseResult && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-2">解析结果：</p>
                  <p className="text-sm text-slate-300">操作类型：<span className="text-emerald-400 font-medium ml-1">{parseResult.action === 'append_prompt' ? '追加 System Prompt' : '修改工具描述'}</span></p>
                  {parseResult.action === 'append_prompt' && <p className="text-sm text-slate-300 mt-1">内容：<span className="text-emerald-300">{parseResult.content}</span></p>}
                  {parseResult.action === 'modify_tool' && (
                    <>
                      <p className="text-sm text-slate-300 mt-1">工具：<span className="text-amber-300 font-mono">{parseResult.toolName}</span></p>
                      <p className="text-sm text-slate-300 mt-1">新描述：<span className="text-amber-300">{parseResult.newDescription}</span></p>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={applyChange} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors">应用修改</button>
                  <button onClick={() => { setStep('idle'); setParseResult(null); setTranscribedText(''); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">取消</button>
                </div>
              </div>
            )}

            {step === 'saved' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <span className="text-2xl">✅</span>
                <span className="text-emerald-400">修改已保存，下次进入场景生效</span>
              </div>
            )}

            {step === 'idle' && (
              <div className="space-y-4">
                <button onClick={startRecording} className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">
                  <span className="text-xl">🎤</span>
                  <span>点击开始录音</span>
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                    placeholder="或输入文字指令..."
                    className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={handleTextSubmit} disabled={!textInput.trim()} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">发送</button>
                </div>
                <p className="text-xs text-slate-500 text-center">示例："追加提示词，让机器人说话更幽默"</p>
              </div>
            )}

            {error && <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          </section>
        </main>

        <footer className="px-6 py-4 border-t border-slate-700/50 bg-slate-800/80">
          <div className="flex items-center justify-between">
            <button onClick={handleReset} disabled={!overrides} className="px-4 py-2 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">恢复默认配置</button>
            <p className="text-xs text-slate-500">{overrides ? `上次修改: ${new Date(overrides.updatedAt).toLocaleString()}` : '尚无自定义配置'}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default MaintenanceMode;
