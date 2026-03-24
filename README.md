# 🏨 Cadastro de Hóspede — Isto É Pousada

> Sistema público de auto-cadastro de hóspedes desenvolvido em **React + Vite**, integrado à API do sistema hoteleiro **SaaS Hotel**.

---

## ✨ Funcionalidades

- **Auto-preenchimento por CPF** — ao digitar um CPF já cadastrado, todos os campos são preenchidos automaticamente
- **Validação de CPF** em tempo real
- **Busca de endereço por CEP** automática
- **Cadastro de veículos** vinculados ao hóspede
- **Formulário em 3 etapas** com barra de progresso
- **DatePicker** customizado com suporte a digitação e seleção por calendário
- Totalmente **responsivo** para mobile

---

## 🛠️ Tecnologias

| Tecnologia | Versão |
|---|---|
| React | 19 |
| Vite | 8 |
| lucide-react | 1.0 |
| CSS Modules | — |

---

## 🚀 Como rodar localmente

```bash
# Clone o repositório
git clone https://github.com/SamInst/cadastro-hospede.git

# Entre na pasta
cd cadastro-hospede

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse em: [http://localhost:5173](http://localhost:5173)

---

## 🔗 Integração com a API

Por padrão o projeto aponta para `localhost:8080`. Para usar em produção, altere a constante em `src/pages/registro/ClienteRegistroPage.jsx`:

```js
// Linha ~29
const BASE_URL = BASE_URL_PROD; // trocar de BASE_URL_LOCAL
```

---

## 📁 Estrutura do projeto

```
src/
├── assets/
│   └── logo-pousada.png
├── components/
│   └── ui/
│       ├── DatePicker.jsx
│       └── DatePicker.module.css
├── pages/
│   └── registro/
│       ├── ClienteRegistroPage.jsx
│       └── ClienteRegistroPage.module.css
├── App.jsx
└── main.jsx
```

---

## 📍 Sobre

**Isto É Pousada** · Referência na Baixada Maranhense
📍 Rodovia MA014 KM38, N612
📱 [(98) 98855-5038](https://wa.me/5598988555038)
