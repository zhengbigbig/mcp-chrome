import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#333' }}>🎯 MCP Debug Console Test</h1>
      <p style={{ color: '#666' }}>如果你看到这个页面，说明 React 和 Vite 工作正常！</p>
      
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginTop: '20px',
        minHeight: '400px'
      }}>
        <div style={{
          flex: 1,
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h2>🖥️ MCP Server Panel</h2>
          <p>这里将显示服务器控制面板</p>
          <button style={{
            background: '#0e639c',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            测试按钮
          </button>
        </div>
        
        <div style={{
          flex: 1,
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '20px',
          borderRadius: '8px'
        }}>
          <h2>💻 MCP Client Panel</h2>
          <p>这里将显示客户端控制面板</p>
          <input 
            type="text" 
            placeholder="测试输入框"
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '10px',
              background: '#3c3c3c',
              border: '1px solid #464647',
              color: '#d4d4d4',
              borderRadius: '4px'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TestApp;
