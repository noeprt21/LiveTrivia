import { useState } from 'react'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🎯 LiveTrivia</h1>
        <p>Quiz multijoueur en temps réel</p>
      </header>
      <main className="app-main">
        <div className="welcome-section">
          <h2>Bienvenue !</h2>
          <p>Créez une partie ou rejoignez vos amis pour un quiz en direct.</p>
          <div className="action-buttons">
            <button className="btn btn-primary">Créer une partie</button>
            <button className="btn btn-secondary">Rejoindre une partie</button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
