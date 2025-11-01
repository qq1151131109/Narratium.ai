# YX-story

> AI-powered Interactive Storytelling Platform

## Features

- 🎭 **Character-Driven Narratives** - Create and interact with AI-powered characters
- 🌍 **Dynamic World Building** - Build rich, interactive story worlds
- 💬 **Real-Time AI Conversations** - Engage in natural dialogues with characters
- 🎨 **Customizable Themes** - Personalize your storytelling experience
- 📱 **Mobile-Friendly Design** - Seamless experience across all devices
- 🔧 **Flexible Configuration** - Support for multiple LLM providers (OpenAI, Ollama)

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/yx-story.git
cd yx-story

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
# Build the project
pnpm build

# Preview the build
pnpm preview
```

## Configuration

Create a `.env.local` file in the root directory with your configuration:

```env
# LLM Configuration
NEXT_PUBLIC_CHAT_LLM_TYPE=openai
NEXT_PUBLIC_CHAT_LLM_BASE_URL=https://api.openai.com/v1
NEXT_PUBLIC_CHAT_LLM_MODEL=gpt-4-turbo
NEXT_PUBLIC_CHAT_LLM_API_KEY=your_api_key_here

# Optional: Database
# Configure if you need persistent storage

# Optional: Authentication
# Configure if you need user authentication
```

See `.env.example` for all available configuration options.

## Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion, GSAP
- **AI/LLM**: LangChain, OpenAI, Ollama
- **State Management**: Zustand
- **Database**: SQLite (better-sqlite3)

## Project Structure

```
yx-story/
├── app/                # Next.js app directory
├── components/         # React components
├── function/           # Business logic
├── hooks/              # Custom React hooks
├── lib/                # Utilities and libraries
├── public/             # Static assets
└── docs/               # Documentation
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For questions or issues, please open an issue on GitHub.

---

Built with ❤️ using Next.js and AI
