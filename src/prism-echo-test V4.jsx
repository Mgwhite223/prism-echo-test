import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Trash2, Settings, Moon, Sun, Menu, X, MessageSquare, ArrowLeft, Zap } from 'lucide-react';

// Markdown 渲染组件
const MarkdownRenderer = ({ content }) => {
  const renderMarkdown = (text) => {
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto my-2"><code>${escapeHtml(code.trim())}</code></pre>`;
    });
    text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">$1</code>');
    text = text.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-500 hover:underline" target="_blank">$1</a>');
    text = text.replace(/^\* (.+)$/gm, '<li class="ml-4">• $1</li>');
    text = text.replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>');
    text = text.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
    text = text.replace(/\n\n/g, '</p><p class="mb-2">');
    text = text.replace(/\n/g, '<br/>');
    return '<p class="mb-2">' + text + '</p>';
  };
  
  const escapeHtml = (text) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  };
  
  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
};

// LLM 测试页面
const LLMTestPage = ({ onBack, darkMode }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('prism-llm-conversations');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) {
        setCurrentConvId(parsed[0].id);
      }
    } else {
      createNewConversation();
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('prism-llm-conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentConvId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 240; // 约10行
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [input]);

  const createNewConversation = () => {
    const newConv = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      config: {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        customModel: '',
        systemPrompt: '你是一个有帮助的AI助手。',
        maxTokens: '',
        temperature: '',
        topP: '',
        topK: '',
        frequencyPenalty: '',
        presencePenalty: ''
      }
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConvId(newConv.id);
  };

  const deleteConversation = (id) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConvId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setCurrentConvId(remaining[0]?.id || null);
      if (remaining.length === 0) {
        createNewConversation();
      }
    }
  };

  const updateConfig = (key, value) => {
    setConversations(prev => prev.map(c => 
      c.id === currentConvId ? { ...c, config: { ...c.config, [key]: value } } : c
    ));
  };

  const currentConv = conversations.find(c => c.id === currentConvId);

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || !currentConv) return;
    
    if (!currentConv.config.apiKey) {
      setError('请先设置 API Key');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const userMessage = { role: 'user', content: input };
    const updatedMessages = [...currentConv.messages, userMessage];
    
    if (updatedMessages.length === 1) {
      const title = input.slice(0, 30) + (input.length > 30 ? '...' : '');
      setConversations(prev => prev.map(c => 
        c.id === currentConvId ? { ...c, title } : c
      ));
    }
    
    setConversations(prev => prev.map(c => 
      c.id === currentConvId ? { ...c, messages: updatedMessages } : c
    ));
    setInput('');
    setIsGenerating(true);

    try {
      const messages = [
        { role: 'system', content: currentConv.config.systemPrompt },
        ...updatedMessages
      ];

      const requestBody = {
        model: currentConv.config.customModel || currentConv.config.model,
        messages,
        stream: true
      };

      if (currentConv.config.maxTokens) requestBody.max_tokens = parseInt(currentConv.config.maxTokens);
      if (currentConv.config.temperature) requestBody.temperature = parseFloat(currentConv.config.temperature);
      if (currentConv.config.topP) requestBody.top_p = parseFloat(currentConv.config.topP);
      if (currentConv.config.topK) requestBody.top_k = parseInt(currentConv.config.topK);
      if (currentConv.config.frequencyPenalty) requestBody.frequency_penalty = parseFloat(currentConv.config.frequencyPenalty);
      if (currentConv.config.presencePenalty) requestBody.presence_penalty = parseFloat(currentConv.config.presencePenalty);

      const response = await fetch(currentConv.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentConv.config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API 错误: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'assistant', content: '' };
      
      setConversations(prev => prev.map(c => 
        c.id === currentConvId ? { ...c, messages: [...updatedMessages, assistantMessage] } : c
      ));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              if (content) {
                assistantMessage.content += content;
                setConversations(prev => prev.map(c => 
                  c.id === currentConvId ? {
                    ...c,
                    messages: [...updatedMessages, { ...assistantMessage }]
                  } : c
                ));
              }
            } catch (e) {
              console.error('解析错误:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('发送消息错误:', err);
      setError(err.message || '发送失败，请检查网络和配置');
      setTimeout(() => setError(''), 5000);
      setConversations(prev => prev.map(c => 
        c.id === currentConvId ? { ...c, messages: updatedMessages } : c
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const exportChat = (format) => {
    if (!currentConv) return;
    
    let content = '';
    let filename = `${currentConv.title}_${Date.now()}`;
    
    if (format === 'md') {
      content = `# ${currentConv.title}\n\n`;
      currentConv.messages.forEach(msg => {
        content += `## ${msg.role === 'user' ? '用户' : '助手'}\n\n${msg.content}\n\n`;
      });
      filename += '.md';
    } else if (format === 'txt') {
      currentConv.messages.forEach(msg => {
        content += `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}\n\n`;
      });
      filename += '.txt';
    } else if (format === 'json') {
      content = JSON.stringify(currentConv, null, 2);
      filename += '.json';
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className="lg:hidden">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">LLM 功能测试</h1>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧历史聊天区 */}
        <div className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col`}>
          <div className="p-3">
            <button
              onClick={createNewConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition"
            >
              <Plus className="w-4 h-4" />
              新建对话
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setCurrentConvId(conv.id)}
                className={`group flex items-center justify-between px-3 py-2 mb-1 rounded-lg cursor-pointer transition ${
                  currentConvId === conv.id
                    ? darkMode ? 'bg-purple-900/50' : 'bg-purple-100'
                    : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <span className="flex-1 truncate text-sm">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 主对话区 */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {currentConv?.messages.map((msg, idx) => (
              <div key={idx} className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl ${msg.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                  <div className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600'
                    }`}>
                      <span className="text-white text-sm font-semibold">
                        {msg.role === 'user' ? 'U' : 'AI'}
                      </span>
                    </div>
                    <div className={`flex-1 px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                        : darkMode ? 'bg-gray-800' : 'bg-white shadow-sm'
                    }`}>
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 text-purple-600">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
                <span className="text-sm">AI 正在思考中...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className={`p-4 border-t ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="max-w-4xl mx-auto">
              <div className={`flex items-end gap-2 p-3 rounded-2xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Shift + Enter 换行，Enter 发送)"
                  className={`flex-1 bg-transparent border-none outline-none resize-none ${darkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '240px', overflow: 'auto' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isGenerating}
                  className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧设置区 */}
        {showSettings && currentConv && (
          <div className={`w-80 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-l overflow-y-auto`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">当前对话设置</h2>
                <button onClick={() => setShowSettings(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 基础 API 设置 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-purple-600">基础 API 设置</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1">API URL</label>
                    <input
                      type="text"
                      value={currentConv.config.apiUrl}
                      onChange={(e) => updateConfig('apiUrl', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">API Key</label>
                    <input
                      type="password"
                      value={currentConv.config.apiKey}
                      onChange={(e) => updateConfig('apiKey', e.target.value)}
                      placeholder="sk-..."
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">预设模型</label>
                    <select
                      value={currentConv.config.model}
                      onChange={(e) => updateConfig('model', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="deepseek-chat">DeepSeek</option>
                      <option value="moonshot-v1">Moonshot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">自定义模型（选填，优先使用）</label>
                    <input
                      type="text"
                      value={currentConv.config.customModel}
                      onChange={(e) => updateConfig('customModel', e.target.value)}
                      placeholder="输入自定义模型名称"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                </div>
              </div>

              {/* 高级参数 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-purple-600">高级参数</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1" title="限制生成的最大token数">Max Tokens</label>
                    <input
                      type="number"
                      value={currentConv.config.maxTokens}
                      onChange={(e) => updateConfig('maxTokens', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" title="控制输出随机性，0-2">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentConv.config.temperature}
                      onChange={(e) => updateConfig('temperature', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" title="核采样参数，0-1">Top P</label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentConv.config.topP}
                      onChange={(e) => updateConfig('topP', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" title="Top-K采样参数">Top K</label>
                    <input
                      type="number"
                      value={currentConv.config.topK}
                      onChange={(e) => updateConfig('topK', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" title="频率惩罚，-2到2">Frequency Penalty</label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentConv.config.frequencyPenalty}
                      onChange={(e) => updateConfig('frequencyPenalty', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" title="存在惩罚，-2到2">Presence Penalty</label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentConv.config.presencePenalty}
                      onChange={(e) => updateConfig('presencePenalty', e.target.value)}
                      placeholder="默认值"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                    />
                  </div>
                </div>
              </div>

              {/* 角色设置 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-purple-600">角色设置</h3>
                <div>
                  <label className="block text-xs mb-1">System Prompt</label>
                  <textarea
                    value={currentConv.config.systemPrompt}
                    onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                    rows={4}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}
                  />
                </div>
              </div>

              {/* 导出 */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-purple-600">导出对话</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportChat('md')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}
                  >
                    .md
                  </button>
                  <button
                    onClick={() => exportChat('txt')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}
                  >
                    .txt
                  </button>
                  <button
                    onClick={() => exportChat('json')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition`}
                  >
                    .json
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 主页面
const HomePage = ({ onSelectTest, darkMode }) => {
  const testModules = [
    {
      id: 'llm',
      title: 'LLM 功能测试',
      description: '测试大语言模型的对话能力、参数调优和流式输出',
      icon: MessageSquare,
      color: 'from-purple-500 to-indigo-600'
    },
    {
      id: 'upcoming',
      title: '更多测试即将到来',
      description: '敬请期待更多测试功能的加入',
      icon: Zap,
      color: 'from-gray-400 to-gray-500',
      disabled: true
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-2xl">PE</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Prism Echo 测试平台
          </h1>
          <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            选择一个测试模块开始
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testModules.map((module) => {
            const Icon = module.icon;
            return (
              <button
                key={module.id}
                onClick={() => !module.disabled && onSelectTest(module.id)}
                disabled={module.disabled}
                className={`group relative p-8 rounded-2xl border-2 transition-all duration-300 text-left ${
                  module.disabled
                    ? darkMode
                      ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                      : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                    : darkMode
                    ? 'border-gray-700 bg-gray-800 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/20'
                    : 'border-gray-200 bg-white hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/20'
                } ${!module.disabled && 'hover:scale-105'}`}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{module.title}</h3>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {module.description}
                </p>
                {!module.disabled && (
                  <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                      <span className="text-white text-xl">→</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 主应用
const PrismEchoTest = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className={`${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {currentPage === 'home' ? (
        <div className="min-h-screen flex flex-col">
          <div className={`flex items-center justify-end px-6 py-4 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          <HomePage onSelectTest={setCurrentPage} darkMode={darkMode} />
        </div>
      ) : currentPage === 'llm' ? (
        <LLMTestPage onBack={() => setCurrentPage('home')} darkMode={darkMode} />
      ) : null}
    </div>
  );
};

export default PrismEchoTest;