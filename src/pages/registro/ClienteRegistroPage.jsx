/**
 * ClienteRegistroPage.jsx
 *
 * Página pública de auto-cadastro de hóspedes — Isto É Pousada.
 * - Sem token (endpoint @PublicEndpoint)
 * - CPF já cadastrado → preenche todos os campos automaticamente
 * - Usa o DatePicker interno do projeto
 *
 * Linguagem visual "Folio de Viana" — mesma do Guia do Hóspede.
 */

import { useState, useRef, useCallback } from 'react';
import {
  User, MapPin, Car, CheckCircle2, AlertTriangle,
  XCircle, Loader2, ChevronLeft, ChevronRight,
  Plus, X, Check,
} from 'lucide-react';

import { DatePicker }  from '../../components/ui/DatePicker';
import styles          from './ClienteRegistroPage.module.css';

// ── URLs ─────────────────────────────────────────────────────────────────────
// Configurável por ambiente: defina VITE_API_BASE_URL no .env (ex.: a URL de
// produção ao publicar). Sem variável, cai para o backend local.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Consulta de CEP: API pública ViaCEP, independente do backend.
const VIACEP_URL = 'https://viacep.com.br/ws';

// ── Listas ────────────────────────────────────────────────────────────────────
const TIPOS_VEICULO = [
  'Carro','Moto','Pickup','SUV','Van','Caminhão','Ônibus','Microônibus','Quadriciclo','Trator',
];

const MARCAS_POR_TIPO = {
  'Carro':       ['Fiat','Volkswagen','Chevrolet','Toyota','Hyundai','Honda','Jeep','Renault','Nissan','Ford','Peugeot','Citroën','BMW','Mercedes-Benz','Audi','Kia','Volvo','Subaru','Mazda','Mitsubishi','Suzuki','Land Rover','Jaguar','Porsche','Tesla','BYD','Chery','Troller','Alfa Romeo','Dodge'],
  'Moto':        ['Honda','Yamaha','Suzuki','Kawasaki','BMW','Ducati','Harley-Davidson','Royal Enfield','Triumph','KTM','Dafra','Shineray','Haojue','Kasinski','Hero'],
  'Pickup':      ['Fiat','Chevrolet','Ford','Toyota','Volkswagen','Renault','Nissan','Mitsubishi','Dodge','Ram','Mercedes-Benz'],
  'SUV':         ['Toyota','Hyundai','Jeep','Honda','Kia','BMW','Mercedes-Benz','Audi','Volvo','Land Rover','Ford','Chevrolet','Nissan','Renault','Mitsubishi','BYD','Peugeot','Citroën'],
  'Van':         ['Mercedes-Benz','Renault','Volkswagen','Ford','Fiat','Peugeot','Citroën','Toyota','Iveco'],
  'Caminhão':    ['Mercedes-Benz','Volvo','Scania','MAN','DAF','Iveco','Ford','Volkswagen','Renault','Agrale'],
  'Ônibus':      ['Mercedes-Benz','Volvo','Scania','MAN','Agrale'],
  'Microônibus': ['Mercedes-Benz','Volkswagen','Agrale','Iveco','Fiat'],
  'Quadriciclo': ['Honda','Yamaha','Kawasaki','Polaris','Can-Am','CF Moto'],
  'Trator':      ['John Deere','Massey Ferguson','New Holland','Valtra','Case','Agrale'],
};

const CORES_VEICULO = [
  'Branco','Preto','Prata','Cinza','Vermelho','Azul','Bege','Marrom','Verde',
  'Amarelo','Laranja','Vinho','Roxo','Dourado','Rosa',
];

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER;

// ── Utils ─────────────────────────────────────────────────────────────────────
const maskCPF   = v => v.replace(/\D/g,'').slice(0,11)
  .replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
const maskPhone = v => {
  const n = v.replace(/\D/g,'').slice(0,11);
  if (n.length > 10) return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');
  return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');
};
const maskCEP   = v => v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d{1,3})$/,'$1-$2');
const maskPlaca = v => v.replace(/[^A-Za-z0-9]/g,'').slice(0,7).toUpperCase();
const unmask    = v => (v ?? '').replace(/\D/g,'');
const up        = v => (v ?? '').toUpperCase().trim();
const cleanPlaca= v => (v ?? '').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
// Placa válida: AAA0A00 (Mercosul) ou AAA0000 (antiga)
const validarPlaca = p => /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(cleanPlaca(p));

const validarCPF = cpf => {
  const n = cpf.replace(/\D/g,'');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(n[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(n[10]);
};

/** Converte dd/MM/yyyy ou yyyy-MM-dd → Date (meio-dia para evitar fuso) */
const parseApiDate = raw => {
  if (!raw) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('/');
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`);
  return null;
};

/** Date → dd/MM/yyyy (para API) */
const toApiDate = d => {
  if (!d) return '';
  if (d instanceof Date) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y,m,day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  return d;
};

const blankVeiculo = () => ({ tipo:'', modelo:'', marca:'', placa:'', cor:'' });
const blankForm    = () => ({
  pessoaId: null,
  nome:'', dataNascimento: null, cpf:'', email:'',
  telefone:'', pais:'Brasil', estado:'', municipio:'',
  endereco:'', cep:'',
  veiculos: [], status: 'ATIVO',
});

// ── WhatsApp / Pin glyphs ───────────────────────────────────────────────────────
function WaIcon({ size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function PinIcon({ size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
}

// ── Combobox ──────────────────────────────────────────────────────────────────
function Combobox({ value, onChange, options, placeholder }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className={styles.comboWrap}
      onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        className={styles.comboInput}
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setQuery(''); setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className={styles.comboDrop}>
          {filtered.map(opt => (
            <button key={opt} type="button" className={styles.comboItem}
              onMouseDown={() => { onChange(opt); setQuery(''); setOpen(false); }}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notificação ───────────────────────────────────────────────────────────────
function Notif({ notif }) {
  if (!notif) return null;
  return (
    <div className={[styles.notif, styles[notif.type]].join(' ')}>
      {notif.type === 'success' && <Check size={15} />}
      {notif.type === 'error'   && <XCircle size={15} />}
      {notif.type === 'info'    && <CheckCircle2 size={15} />}
      {notif.message}
    </div>
  );
}

// ── Section title ───────────────────────────────────────────────────────────────
function SectionTitle({ icon, label }) {
  return <div className={styles.secTitle}>{icon}<span>{label}</span></div>;
}

// ── Step intro ──────────────────────────────────────────────────────────────────
function StepHead({ kicker, title }) {
  return (
    <div className={styles.stepHead}>
      <div className={styles.stepKicker}>{kicker}</div>
      <h2 className={styles.stepTitle}>{title}</h2>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ClienteRegistroPage() {
  const [step,        setStep]        = useState(1);   // 1 | 2 | 3 | 'done'
  const [form,        setForm]        = useState(blankForm());
  const [isEdit,      setIsEdit]      = useState(false); // true = atualização
  const [showErrors,     setShowErrors]     = useState(false);
  const [showVeicErrors, setShowVeicErrors] = useState(false);
  const [isSubmitting,setIsSubmitting]= useState(false);
  const [notif,       setNotif]       = useState(null);
  const notifTimer = useRef(null);

  // CPF status
  const [cpfStatus, setCpfStatus] = useState(null); // null | 'loading' | 'invalid' | 'exists' | 'ok'
  const cpfDebounce = useRef(null);

  // CEP
  const [cepLoading, setCepLoading] = useState(false);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const showNotif = useCallback((message, type = 'success') => {
    clearTimeout(notifTimer.current);
    setNotif({ message, type });
    notifTimer.current = setTimeout(() => setNotif(null), 3500);
  }, []);

  // ── CPF ────────────────────────────────────────────────────────────────────
  const handleCPF = async v => {
    const masked = maskCPF(v);
    set('cpf', masked);
    const raw = unmask(masked);

    if (raw.length < 11) { setCpfStatus(null); return; }
    if (!validarCPF(raw)) { setCpfStatus('invalid'); return; }

    setCpfStatus('loading');
    clearTimeout(cpfDebounce.current);
    cpfDebounce.current = setTimeout(async () => {
      try {
        // Endpoint público dedicado: busca por CPF EXATO, sem busca por nome/termo
        // (que exige autenticação) — evita enumeração de dados pessoais.
        // 200 → cadastrado · 204 → CPF válido e não cadastrado · 400 → CPF inválido
        const res = await fetch(`${BASE_URL}/pessoa/cpf/${raw}`);

        if (res.status === 200) {
          const found = await res.json();
          setCpfStatus('exists');
          // ── Preenche todos os campos com os dados da pessoa ──
          const rawNasc = found.data_nascimento ?? found.dataNascimento ?? '';
          setForm({
            pessoaId:       found.id,
            nome:           found.nome ?? '',
            dataNascimento: parseApiDate(rawNasc),
            cpf:            masked,
            email:          found.email ?? '',
            telefone:       maskPhone(found.telefone ?? ''),
            pais:           found.pais ?? 'Brasil',
            estado:         found.estado ?? '',
            municipio:      found.municipio ?? '',
            endereco:       found.endereco ?? '',
            cep:            maskCEP(found.cep ?? ''),
            status:         found.status ?? 'ATIVO',
            veiculos: (found.veiculos_vinculados ?? []).map(v => ({
              id:     v.id,
              modelo: v.modelo ?? '',
              marca:  v.marca  ?? '',
              ano:    String(v.ano ?? ''),
              placa:  v.placa  ?? '',
              cor:    v.cor    ?? '',
            })),
          });
          setIsEdit(true);
          showNotif('Cadastro encontrado — campos preenchidos automaticamente.', 'info');
        } else if (res.status === 204) {
          setCpfStatus('ok');
          setIsEdit(false);
          // limpa tudo exceto o CPF
          setForm(p => ({ ...blankForm(), cpf: p.cpf }));
        } else if (res.status === 429) {
          setCpfStatus(null);
          showNotif('Muitas tentativas. Aguarde alguns instantes.', 'error');
        } else {
          setCpfStatus(null);
        }
      } catch {
        setCpfStatus(null);
      }
    }, 500);
  };

  // ── CEP ─────────────────────────────────────────────────────────────────────
  const handleCEP = async v => {
    const masked = maskCEP(v);
    set('cep', masked);
    if (unmask(masked).length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`${VIACEP_URL}/${unmask(masked)}/json/`);

      if (!res.ok) {
        showNotif('Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'error');
        return;
      }

      const d = await res.json();

      // CEP inexistente: o ViaCEP responde 200 com { erro: "true" }.
      if (d.erro) {
        showNotif('CEP não encontrado. Confira os dígitos.', 'error');
        return;
      }

      // Uma única linha de endereço: "Rua Tal - Bairro".
      const linha = [d.logradouro, d.bairro].filter(Boolean).join(' - ');

      setForm(p => ({
        ...p,
        cep:       masked,
        endereco:  linha        || p.endereco,
        pais:      'Brasil',
        estado:    d.estado     || d.uf || p.estado,
        municipio: d.localidade || p.municipio,
      }));

      // CEP geral de cidade: vem sem logradouro/bairro.
      if (!linha) showNotif('CEP localizado. Informe a rua e o número.', 'info');
    } catch {
      // Rede fora do ar, CORS ou CSP bloqueando a chamada.
      showNotif('Não foi possível consultar o CEP. Verifique sua conexão.', 'error');
    } finally {
      setCepLoading(false);
    }
  };

  // ── Veículos ────────────────────────────────────────────────────────────────
  const addVeiculo    = () => setForm(p => ({ ...p, veiculos: [...p.veiculos, blankVeiculo()] }));
  const removeVeiculo = i  => setForm(p => ({ ...p, veiculos: p.veiculos.filter((_,j) => j !== i) }));
  const setVeiculo    = (i, field, val) =>
    setForm(p => ({ ...p, veiculos: p.veiculos.map((v,j) => j === i ? { ...v, [field]: val } : v) }));

  // ── Validação step 1 ────────────────────────────────────────────────────────
  const required1 = { cpf: form.cpf, nome: form.nome, dataNascimento: form.dataNascimento,
                      telefone: form.telefone, cep: form.cep,
                      endereco: form.endereco };
  const missingField = f => !required1[f];

  // Validações de formato/completude
  const cpfCompleto    = validarCPF(unmask(form.cpf));                       // 11 dígitos + dígitos verificadores
  const telefoneValido = [10, 11].includes(unmask(form.telefone).length);   // (xx) xxxx-xxxx ou (xx) 9 xxxx-xxxx
  const emailValido    = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  // Demais campos de endereco so aparecem depois do CEP completo.
  const cepCompleto    = unmask(form.cep).length === 8;

  const goNext = () => {
    setShowErrors(true);
    if (Object.values(required1).some(v => !v)) {
      showNotif('Preencha todos os campos obrigatórios (*).', 'error'); return;
    }
    if (!cpfCompleto)    { showNotif('Informe um CPF válido (11 dígitos).', 'error'); return; }
    if (!telefoneValido) { showNotif('Informe um telefone válido: (xx) xxxxx-xxxx.', 'error'); return; }
    if (!emailValido)    { showNotif('Informe um e-mail válido (ex: nome@email.com).', 'error'); return; }
    setShowErrors(false);
    setStep(s => s + 1);
  };
  const goBack = () => setStep(s => s - 1);

  const goToStep3 = () => {
    setShowVeicErrors(true);
    if (form.veiculos.some(v => !v.placa)) {
      showNotif('Informe a placa de todos os veículos (*).', 'error'); return;
    }
    if (form.veiculos.some(v => !validarPlaca(v.placa))) {
      showNotif('Informe uma placa válida: AAA0A00 ou AAA0000.', 'error'); return;
    }
    setShowVeicErrors(false);
    setStep(3);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Apenas campos que o próprio hóspede pode informar. status / titular /
      // empresas / funcionario / id são controlados pelo servidor (upsert por CPF).
      const body = {
        nome:            up(form.nome),
        data_nascimento: toApiDate(form.dataNascimento),
        cpf:             unmask(form.cpf),
        email:           form.email.trim() || null,
        telefone:        unmask(form.telefone),
        pais:            up(form.pais) || 'BRASIL',
        estado:          up(form.estado),
        municipio:       up(form.municipio),
        endereco:        up(form.endereco),
        cep:             unmask(form.cep),
        veiculos: form.veiculos.map(v => ({
          ...(v.id ? { id: v.id } : {}),
          modelo: up(v.modelo),
          marca:  up(v.marca),
          placa:  cleanPlaca(v.placa),
          cor:    up(v.cor),
        })),
      };

      // Endpoint público único de escrita — o servidor decide criar/atualizar
      // pelo CPF (sem id do cliente → sem IDOR).
      const res = await fetch(`${BASE_URL}/pessoa/auto-cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Mostra a mensagem do servidor apenas em erros de validação (4xx),
        // que são controlados. Para 5xx, mensagem genérica — não expõe internos.
        let msg = res.status === 429
          ? 'Muitas tentativas. Aguarde alguns instantes e tente novamente.'
          : 'Erro ao salvar cadastro. Tente novamente.';
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          try {
            const d = await res.json();
            if (d?.message) msg = d.message;
          } catch {
            // corpo não-JSON: mantém a mensagem genérica
          }
        }
        throw new Error(msg);
      }

      setStep('done');
      const waMsg = encodeURIComponent(`${up(form.nome)}\nOlá, fiz meu cadastro no site.`);
      window.open(`https://wa.me/${WA_NUMBER}?text=${waMsg}`, '_blank');
    } catch(e) {
      showNotif(e.message || 'Erro ao salvar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CPF visuals ──────────────────────────────────────────────────────────────
  const cpfIcon = cpfStatus === 'loading' ? <Loader2 size={15} className={styles.spin} />
    : cpfStatus === 'ok'      ? <CheckCircle2 size={15} className={styles.iconOk}   />
    : cpfStatus === 'exists'  ? <CheckCircle2 size={15} className={styles.iconGold} />
    : cpfStatus === 'invalid' ? <XCircle size={15} className={styles.iconErr} />
    : null;

  const cpfCls = [
    styles.input,
    cpfStatus === 'ok'           ? styles.inputOk   : '',
    cpfStatus === 'exists'       ? styles.inputInfo : '',
    cpfStatus === 'invalid'      ? styles.inputErr  : '',
    showErrors && !cpfCompleto   ? styles.inputErr  : '',
  ].filter(Boolean).join(' ');

  const errCls = f => [styles.input, showErrors && missingField(f) ? styles.inputErr : ''].filter(Boolean).join(' ');
  const lblErr = f => [styles.label, showErrors && missingField(f) ? styles.labelErr : ''].filter(Boolean).join(' ');

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.shell}>

      {/* ── Masthead ── */}
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>Cadastro de Hóspede</p>
        <h1 className={styles.title}>Isto É <em>Pousada</em></h1>
        <p className={styles.place}>Viana · Maranhão</p>
        <p className={styles.welcome}>
          Preencha seus dados para agilizar sua chegada. Já é nosso hóspede?
          Informe o CPF e cuidamos do resto.
        </p>
      </header>

      {/* ── Card ── */}
      <div className={styles.card}>

        {/* ══ STEP 1 ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <div className={styles.body}>
              <StepHead kicker="Etapa 1 de 3" title="Seus dados pessoais" />

              <div className={styles.stagger}>
                {isEdit && (
                  <div className={[styles.note, styles.noteOk].join(' ')}>
                    <AlertTriangle size={18} />
                    <span><strong>Cadastro encontrado.</strong> Confira e atualize o que for necessário antes de confirmar.</span>
                  </div>
                )}

                <SectionTitle icon={<User size={14} />} label="Identificação" />

                <div className={styles.gridCpf} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[styles.label, styles.req, showErrors && !form.cpf ? styles.labelErr : ''].filter(Boolean).join(' ')}>CPF</label>
                    <div className={styles.inputWrap}>
                      <input className={cpfCls} value={form.cpf} onChange={e => handleCPF(e.target.value)}
                        placeholder="000.000.000-00" maxLength={14} autoComplete="off" inputMode="numeric" />
                      {cpfIcon && <span className={styles.inputSuffix}>{cpfIcon}</span>}
                    </div>
                    {cpfStatus === 'invalid' && <span className={[styles.fieldMsg, styles.msgErr].join(' ')}>CPF inválido</span>}
                    {cpfStatus === 'exists'  && <span className={[styles.fieldMsg, styles.msgInfo].join(' ')}>Cadastro encontrado</span>}
                    {cpfStatus === 'ok'      && <span className={[styles.fieldMsg, styles.msgOk].join(' ')}>CPF disponível</span>}
                    {showErrors && form.cpf && !cpfCompleto && cpfStatus !== 'invalid' &&
                      <span className={[styles.fieldMsg, styles.msgErr].join(' ')}>CPF incompleto</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={[lblErr('nome'), styles.req].join(' ')}>Nome completo</label>
                    <input className={errCls('nome')} value={form.nome}
                      onChange={e => set('nome', e.target.value)} placeholder="Seu nome completo" />
                  </div>
                  <div className={styles.field}>
                    <label className={[lblErr('dataNascimento'), styles.req].join(' ')}>Nascimento</label>
                    <DatePicker
                      mode="single"
                      value={form.dataNascimento}
                      onChange={d => set('dataNascimento', d ?? null)}
                      maxDate={new Date()}
                      placeholder="dd/mm/aaaa"
                      error={showErrors && !form.dataNascimento}
                      disablePopup
                    />
                  </div>
                </div>

                <div className={styles.grid2} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[lblErr('telefone'), styles.req].join(' ')}>Telefone</label>
                    <input
                      className={[styles.input, showErrors && (!form.telefone || !telefoneValido) ? styles.inputErr : ''].filter(Boolean).join(' ')}
                      value={form.telefone}
                      onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" />
                    {showErrors && form.telefone && !telefoneValido &&
                      <span className={[styles.fieldMsg, styles.msgErr].join(' ')}>Telefone incompleto</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <input
                      className={[styles.input, showErrors && !emailValido ? styles.inputErr : ''].filter(Boolean).join(' ')}
                      type="email" value={form.email}
                      onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
                    {showErrors && !emailValido &&
                      <span className={[styles.fieldMsg, styles.msgErr].join(' ')}>E-mail inválido</span>}
                  </div>
                </div>

                <SectionTitle icon={<MapPin size={14} />} label="Endereço" />

                <div className={styles.grid2} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[lblErr('cep'), styles.req].join(' ')}>CEP</label>
                    <div className={styles.inputWrap}>
                      <input className={errCls('cep')} value={form.cep}
                        onChange={e => handleCEP(e.target.value)} placeholder="00000-000" inputMode="numeric" />
                      {cepLoading && <span className={styles.inputSuffix}><Loader2 size={14} className={styles.spin} /></span>}
                    </div>
                  </div>
                </div>

                {cepCompleto && (
                  <div className={styles.reveal}>
                    <div className={styles.grid3} style={{ marginBottom: 16 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>País</label>
                        <input className={styles.input} value={form.pais} onChange={e => set('pais', e.target.value)} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Estado</label>
                        <input className={styles.input} value={form.estado}
                          onChange={e => set('estado', e.target.value)} placeholder="Estado" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Município</label>
                        <input className={styles.input} value={form.municipio} onChange={e => set('municipio', e.target.value)} />
                      </div>
                    </div>

                    <div className={styles.field}>
                      <label className={[lblErr('endereco'), styles.req].join(' ')}>Endereço</label>
                      <input className={errCls('endereco')} value={form.endereco}
                        onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, complemento" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={goNext}>
                Continuar <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 2 ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            <div className={styles.body}>
              <div className={styles.headRow}>
                <StepHead kicker="Etapa 2 de 3" title="Veículos" />
                <button className={[styles.btn, styles.btnSm].join(' ')} onClick={addVeiculo}>
                  <Plus size={13} /> Adicionar
                </button>
              </div>

              <div className={styles.stagger}>
                {form.veiculos.length === 0 && (
                  <div className={styles.emptyVeh}>
                    <Car size={30} style={{ opacity: 0.4, color: 'var(--accent)' }} />
                    <span>Nenhum veículo adicionado</span>
                  </div>
                )}

                {form.veiculos.map((v, i) => {
                  const placaErr = showVeicErrors && !validarPlaca(v.placa);
                  const marcas = MARCAS_POR_TIPO[v.tipo] ?? [];
                  return (
                    <div key={i} className={styles.vehCard}>
                      <div className={styles.vehHead}>
                        <Car size={15} />
                        <span>Veículo {i + 1}</span>
                        {v.placa && <span className={styles.placaBadge}>{v.placa}</span>}
                        <button className={styles.btnRemove} onClick={() => removeVeiculo(i)}><X size={14} /></button>
                      </div>
                      <div className={styles.grid3} style={{ marginBottom: 12 }}>
                        <div className={styles.field}>
                          <label className={styles.label}>Tipo</label>
                          <select className={styles.input} value={v.tipo}
                            onChange={e => { setVeiculo(i,'tipo',e.target.value); setVeiculo(i,'marca',''); }}>
                            <option value="">Selecione</option>
                            {TIPOS_VEICULO.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Modelo</label>
                          <input className={styles.input} value={v.modelo}
                            onChange={e => setVeiculo(i,'modelo',e.target.value)} placeholder="Ex: Civic" />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Marca</label>
                          <Combobox value={v.marca} onChange={val => setVeiculo(i,'marca',val)}
                            options={marcas} placeholder={v.tipo ? 'Selecione a marca' : 'Selecione o tipo antes'} />
                        </div>
                      </div>
                      <div className={styles.grid2}>
                        <div className={styles.field}>
                          <label className={[styles.label, styles.req].join(' ')}>Placa</label>
                          <input className={[styles.input, placaErr ? styles.inputErr : ''].join(' ')} value={v.placa}
                            onChange={e => setVeiculo(i,'placa',maskPlaca(e.target.value))}
                            placeholder="AAA0A00" maxLength={7} />
                          {showVeicErrors && v.placa && !validarPlaca(v.placa) &&
                            <span className={[styles.fieldMsg, styles.msgErr].join(' ')}>Placa inválida</span>}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Cor</label>
                          <Combobox value={v.cor} onChange={val => setVeiculo(i,'cor',val)}
                            options={CORES_VEICULO} placeholder="Ex: Preto" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.footer}>
              <button className={[styles.btn, styles.btnGhost].join(' ')} onClick={goBack}><ChevronLeft size={15} /> Voltar</button>
              <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={goToStep3}>
                {form.veiculos.length === 0 ? 'Pular etapa' : 'Continuar'} <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 3 ══════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            <div className={styles.body}>
              <StepHead kicker="Etapa 3 de 3" title="Confirme seus dados" />

              <div className={styles.stagger}>
                <div className={styles.confirmCard}>
                  <div className={styles.confirmInfo}>
                    <div className={styles.confirmName}>{up(form.nome) || '—'}</div>
                    <div className={styles.confirmMeta}>CPF: {form.cpf || '—'}</div>
                    {form.dataNascimento && (
                      <div className={styles.confirmMeta}>Nascimento: {form.dataNascimento.toLocaleDateString('pt-BR')}</div>
                    )}
                    {form.telefone && <div className={styles.confirmMeta}>Telefone: {form.telefone}</div>}
                    {form.email && <div className={styles.confirmMeta}>Email: {form.email}</div>}
                    {form.cep && <div className={styles.confirmMeta}>{form.cep} — {[form.municipio, form.estado].filter(Boolean).join(', ')}</div>}
                  </div>
                  {isEdit && <span className={styles.editBadge}>Atualização</span>}
                </div>

                {form.veiculos.length > 0 && (
                  <>
                    <p className={styles.confirmSub}>Veículos</p>
                    {form.veiculos.map((v, i) => {
                      const nome = [up(v.marca), up(v.modelo)].filter(Boolean).join(' ');
                      return (
                        <div key={i} className={styles.confirmCard}>
                          <div className={styles.confirmInfo}>
                            <div className={styles.confirmName}>{[nome, up(v.placa)].filter(Boolean).join(' · ') || '—'}</div>
                            <div className={styles.confirmMeta}>{up(v.cor) || '—'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button className={[styles.btn, styles.btnGhost].join(' ')} onClick={goBack} disabled={isSubmitting}>
                <ChevronLeft size={15} /> Voltar
              </button>
              <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting
                  ? <><Loader2 size={14} className={styles.spin} /> Salvando...</>
                  : isEdit ? <>Confirmar Atualização <Check size={15} /></> : <>Confirmar Cadastro <Check size={15} /></>
                }
              </button>
            </div>
          </>
        )}

        {/* ══ DONE ════════════════════════════════════════════════════════════ */}
        {step === 'done' && (() => {
          const nome = up(form.nome);
          const waMsg = encodeURIComponent(`${nome}\nOlá, fiz meu cadastro no site.`);
          const waUrl = `https://wa.me/${WA_NUMBER}?text=${waMsg}`;
          return (
            <div className={styles.done}>
              <div className={styles.doneMark}><Check size={38} strokeWidth={2.4} /></div>
              <h2 className={styles.doneTitle}>{isEdit ? 'Dados atualizados!' : 'Cadastro realizado!'}</h2>
              <p className={styles.doneText}>
                {isEdit
                  ? 'Suas informações foram atualizadas com sucesso.'
                  : 'Seja bem-vindo(a)! Seu cadastro foi registrado com sucesso.'}
              </p>

              <div className={styles.doneSummary}>
                <div className={styles.doneRow}><span>Nome</span><strong>{nome || '—'}</strong></div>
                <div className={styles.doneRow}><span>CPF</span><strong>{form.cpf || '—'}</strong></div>
                {form.dataNascimento && (
                  <div className={styles.doneRow}><span>Nascimento</span><strong>{form.dataNascimento.toLocaleDateString('pt-BR')}</strong></div>
                )}
                <div className={styles.doneRow}><span>Telefone</span><strong>{form.telefone || '—'}</strong></div>
                {form.email && <div className={styles.doneRow}><span>Email</span><strong>{form.email}</strong></div>}
                {form.municipio && (
                  <div className={styles.doneRow}><span>Cidade</span><strong>{[form.municipio, form.estado].filter(Boolean).join(' / ')}</strong></div>
                )}
              </div>

              <a href={waUrl} target="_blank" rel="noopener noreferrer" className={styles.doneWa}>
                <WaIcon size={18} /> Falar no WhatsApp
              </a>
            </div>
          );
        })()}

      </div>{/* /card */}

      {/* ── Colophon ── */}
      <footer className={styles.colophon}>
        <span className={styles.cphLgpd}>
          Seus dados são tratados conforme a LGPD (Lei nº 13.709/2018) e usados apenas para a sua hospedagem.
        </span>
        <span className={styles.cphAddr}><PinIcon size={12} /> Rodovia MA014 KM38, N612 · Viana</span>
      </footer>

      <Notif notif={notif} />
    </div>
  );
}
