/**
 * ClienteRegistroPage.jsx
 *
 * Página pública de auto-cadastro de hóspedes.
 * - Sem token (endpoint @PublicEndpoint)
 * - CPF já cadastrado → preenche todos os campos automaticamente
 * - Usa o DatePicker interno do projeto
 *
 * Coloque o arquivo em:  src/pages/registro/ClienteRegistroPage.jsx
 * Adicione a rota pública no seu router (sem RequireAuth):
 *   <Route path="/registro" element={<ClienteRegistroPage />} />
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, MapPin, Car, CheckCircle2, AlertTriangle,
  XCircle, Loader2, ChevronLeft, ChevronRight,
  Plus, X, Building2, Check,
} from 'lucide-react';

import { DatePicker }  from '../../components/ui/DatePicker';
import styles          from './ClienteRegistroPage.module.css';

// ── URLs ─────────────────────────────────────────────────────────────────────
const BASE_URL_LOCAL = 'http://localhost:8080';
const BASE_URL_PROD  = 'https://saas-hotel-istoepousada-dc98593a88fc.herokuapp.com';

// ▶ Troque para BASE_URL_PROD ao publicar
const BASE_URL = BASE_URL_PROD;

// ── Listas ────────────────────────────────────────────────────────────────────
const MARCAS_VEICULO = [
  'Fiat','Volkswagen','Chevrolet','Toyota','Hyundai','Honda','Jeep','Renault','Nissan','Ford',
  'Peugeot','Citroën','BMW','Mercedes-Benz','Audi','Kia','Volvo','Subaru','Mazda','Mitsubishi',
  'Suzuki','Land Rover','Jaguar','Porsche','Tesla','BYD','Chery','Troller','Alfa Romeo','Dodge',
];
const CORES_VEICULO = [
  'Branco','Preto','Prata','Cinza','Vermelho','Azul','Bege','Marrom','Verde',
  'Amarelo','Laranja','Vinho','Roxo','Dourado','Rosa',
];
const currentYear = new Date().getFullYear();
const ANOS_VEICULO = Array.from({ length: currentYear - 1999 }, (_, i) => String(currentYear - i));

const SEXO_OPTS = [
  { value: '',  label: 'Selecione' },
  { value: '1', label: 'Masculino' },
  { value: '2', label: 'Feminino'  },
  { value: '3', label: 'Outro'     },
];

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

const blankVeiculo = () => ({ modelo:'', marca:'', ano:'', placa:'', cor:'' });
const blankForm    = () => ({
  pessoaId: null,
  nome:'', dataNascimento: null, cpf:'', rg:'', email:'', profissao:'',
  telefone:'', sexo:'', pais:'Brasil', estado:'', municipio:'',
  endereco:'', complemento:'', cep:'', bairro:'', numero:'',
  veiculos: [], status: 'ATIVO',
});

// ── Combobox ──────────────────────────────────────────────────────────────────
function Combobox({ value, onChange, options, placeholder }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className={styles.comboWrap}>
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
      {notif.type === 'success' && <Check size={14} />}
      {notif.type === 'error'   && <XCircle size={14} />}
      {notif.message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ClienteRegistroPage() {
  const [step,        setStep]        = useState(1);   // 1 | 2 | 3 | 'done'
  const [form,        setForm]        = useState(blankForm());
  const [isEdit,      setIsEdit]      = useState(false); // true = atualização
  const [showErrors,  setShowErrors]  = useState(false);
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
        const res  = await fetch(`${BASE_URL}/pessoa?termo=${raw}&size=1`);
        const data = await res.json();
        const found = (data?.content ?? [])[0];

        if (found) {
          setCpfStatus('exists');
          // ── Preenche todos os campos com os dados da pessoa ──
          const rawNasc = found.data_nascimento ?? found.dataNascimento ?? '';
          setForm({
            pessoaId:       found.id,
            nome:           found.nome ?? '',
            dataNascimento: parseApiDate(rawNasc),
            cpf:            masked,
            rg:             found.rg ?? '',
            email:          found.email ?? '',
            profissao:      found.profissao ?? '',
            telefone:       maskPhone(found.telefone ?? ''),
            sexo:           String(found.sexo ?? ''),
            pais:           found.pais ?? 'Brasil',
            estado:         found.estado ?? '',
            municipio:      found.municipio ?? '',
            endereco:       found.endereco ?? '',
            complemento:    found.complemento ?? '',
            cep:            maskCEP(found.cep ?? ''),
            bairro:         found.bairro ?? '',
            numero:         found.numero ?? '',
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
        } else {
          setCpfStatus('ok');
          setIsEdit(false);
          // limpa tudo exceto o CPF
          setForm(p => ({ ...blankForm(), cpf: p.cpf }));
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
    if (unmask(masked).length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/cep/${unmask(masked)}`);
        if (res.ok) {
          const d = await res.json();
          setForm(p => ({
            ...p,
            cep:       masked,
            endereco:  d.endereco              || p.endereco,
            bairro:    d.bairro                || p.bairro,
            pais:      d.pais?.descricao       || p.pais,
            estado:    d.estado?.descricao     || p.estado,
            municipio: d.municipio?.descricao  || p.municipio,
          }));
        }
      } finally { setCepLoading(false); }
    }
  };

  // ── Veículos ────────────────────────────────────────────────────────────────
  const addVeiculo    = () => setForm(p => ({ ...p, veiculos: [...p.veiculos, blankVeiculo()] }));
  const removeVeiculo = i  => setForm(p => ({ ...p, veiculos: p.veiculos.filter((_,j) => j !== i) }));
  const setVeiculo    = (i, field, val) =>
    setForm(p => ({ ...p, veiculos: p.veiculos.map((v,j) => j === i ? { ...v, [field]: val } : v) }));

  // ── Validação step 1 ────────────────────────────────────────────────────────
  const required1 = { cpf: form.cpf, nome: form.nome, dataNascimento: form.dataNascimento,
                      telefone: form.telefone, email: form.email, cep: form.cep };
  const missingField = f => !required1[f];
  const step1Valid = Object.values(required1).every(v => !!v) && cpfStatus !== 'invalid';

  const goNext = () => {
    if (!step1Valid) { setShowErrors(true); showNotif('Preencha todos os campos obrigatórios (*).', 'error'); return; }
    setShowErrors(false);
    setStep(s => s + 1);
  };
  const goBack = () => setStep(s => s - 1);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const body = {
        nome:            up(form.nome),
        data_nascimento: toApiDate(form.dataNascimento),
        cpf:             unmask(form.cpf),
        rg:              up(form.rg),
        email:           form.email.trim(),
        profissao:       up(form.profissao),
        telefone:        unmask(form.telefone),
        pais:            up(form.pais) || 'BRASIL',
        estado:          up(form.estado),
        municipio:       up(form.municipio),
        endereco:        up(form.endereco),
        complemento:     up(form.complemento),
        cep:             unmask(form.cep),
        bairro:          up(form.bairro),
        sexo:            Number(form.sexo) || 1,
        numero:          up(form.numero),
        status:          form.status ?? 'ATIVO',
        titular:         null,
        empresas:        [],
        veiculos: form.veiculos.map(v => ({
          ...(v.id ? { id: v.id } : {}),
          modelo: up(v.modelo), marca: up(v.marca),
          ano:    Number(v.ano) || 0,
          placa:  cleanPlaca(v.placa),
          cor:    up(v.cor),
        })),
        funcionario: null,
      };

      let res;
      if (isEdit && form.pessoaId) {
        // Atualização → PUT /pessoa
        res = await fetch(`${BASE_URL}/pessoa`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: form.pessoaId, ...body }),
        });
      } else {
        // Novo cadastro → POST /pessoa (sem token, @PublicEndpoint)
        res = await fetch(`${BASE_URL}/pessoa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pessoas: [body], empresas: [] }),
        });
      }

      if (!res.ok) {
        let msg = 'Erro ao salvar cadastro.';
        try { const d = await res.json(); msg = d?.message || d?.error || msg; } catch {}
        throw new Error(msg);
      }

      setStep('done');
    } catch(e) {
      showNotif(e.message || 'Erro ao salvar.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── CPF icon ─────────────────────────────────────────────────────────────────
  const cpfIcon = cpfStatus === 'loading' ? <Loader2 size={15} className={styles.spin} />
    : cpfStatus === 'ok'      ? <CheckCircle2 size={15} className={styles.iconOk}   />
    : cpfStatus === 'exists'  ? <AlertTriangle size={15} className={styles.iconErr} />
    : cpfStatus === 'invalid' ? <XCircle size={15} className={styles.iconErr} />
    : null;

  const cpfCls = [
    styles.input,
    cpfStatus === 'ok'      ? styles.inputOk   : '',
    cpfStatus === 'exists'  ? styles.inputErr   : '',
    cpfStatus === 'invalid' ? styles.inputErr  : '',
    showErrors && !form.cpf ? styles.inputErr  : '',
  ].filter(Boolean).join(' ');

  const errCls = f => [styles.input, showErrors && missingField(f) ? styles.inputErr : ''].filter(Boolean).join(' ');
  const lblErr = f => [styles.label, showErrors && missingField(f) ? styles.labelErr : ''].filter(Boolean).join(' ');

  // ── Step bar labels ──────────────────────────────────────────────────────────
  const STEPS = ['Dados Pessoais', 'Veículos', 'Confirmação'];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── decoração de fundo ── */}
      <div className={styles.bgBlob1} />
      <div className={styles.bgBlob2} />

      <div className={styles.wrap}>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLine} />
          <h1 className={styles.title}>Cadastro de Hóspede</h1>
          <p className={styles.subtitle}>Preencha seus dados para completar o cadastro</p>
        </header>

        <div className={styles.card}>

          {/* Steps bar */}
          {step !== 'done' && (
            <div className={styles.stepsBar}>
              {STEPS.map((label, i) => {
                const n = i + 1;
                const state = step === n ? 'active' : (typeof step === 'number' && step > n) ? 'done' : '';
                return (
                  <div key={label} className={[styles.stepItem, styles[state]].filter(Boolean).join(' ')}>
                    <div className={styles.stepNum}>
                      {state === 'done' ? <Check size={11} /> : n}
                    </div>
                    <span className={styles.stepLabel}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ STEP 1: Dados Pessoais ══════════════════════════════════════════ */}
          {step === 1 && (
            <>
              <div className={styles.body}>

                {isEdit && (
                  <div className={styles.infoBanner}>
                    <AlertTriangle size={14} />
                    Cadastro existente carregado. Atualize os campos necessários e confirme.
                  </div>
                )}

                <SectionDiv icon={<User size={12} />} label="Dados Pessoais" />

                {/* CPF + Nome + Nasc */}
                <div className={styles.gridCpfRow} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[styles.label, styles.req, showErrors && !form.cpf ? styles.labelErr : ''].filter(Boolean).join(' ')}>CPF</label>
                    <div className={styles.inputWrap}>
                      <input className={cpfCls} value={form.cpf} onChange={e => handleCPF(e.target.value)}
                        placeholder="000.000.000-00" maxLength={14} autoComplete="off" />
                      {cpfIcon && <span className={styles.inputSuffix}>{cpfIcon}</span>}
                    </div>
                    {cpfStatus === 'invalid' && <span className={styles.fieldMsg} style={{ color:'#c0392b' }}>CPF inválido</span>}
                    {cpfStatus === 'exists'  && <span className={styles.fieldMsg} style={{ color:'#c0392b' }}>CPF já cadastrado</span>}
                    {cpfStatus === 'ok'      && <span className={styles.fieldMsg} style={{ color:'#27855a' }}>CPF disponível</span>}
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
                    />
                  </div>
                </div>

                {/* Tel + Sexo + RG */}
                <div className={styles.grid3} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[lblErr('telefone'), styles.req].join(' ')}>Telefone</label>
                    <input className={errCls('telefone')} value={form.telefone}
                      onChange={e => set('telefone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Sexo</label>
                    <select className={styles.input} value={form.sexo} onChange={e => set('sexo', e.target.value)}>
                      {SEXO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>RG</label>
                    <input className={styles.input} value={form.rg}
                      onChange={e => set('rg', e.target.value)} placeholder="RG" />
                  </div>
                </div>

                {/* Email + Profissão */}
                <div className={styles.grid2} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[lblErr('email'), styles.req].join(' ')}>Email</label>
                    <input className={errCls('email')} type="email" value={form.email}
                      onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Profissão</label>
                    <input className={styles.input} value={form.profissao}
                      onChange={e => set('profissao', e.target.value)} placeholder="Ex: Engenheiro" />
                  </div>
                </div>

                <SectionDiv icon={<MapPin size={12} />} label="Endereço" />

                {/* CEP + País + Estado */}
                <div className={styles.grid3} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={[lblErr('cep'), styles.req].join(' ')}>CEP</label>
                    <div className={styles.inputWrap}>
                      <input className={errCls('cep')} value={form.cep}
                        onChange={e => handleCEP(e.target.value)} placeholder="00000-000" />
                      {cepLoading && <span className={styles.inputSuffix}><Loader2 size={13} className={styles.spin} /></span>}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>País</label>
                    <input className={styles.input} value={form.pais} onChange={e => set('pais', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Estado</label>
                    <input className={styles.input} value={form.estado}
                      onChange={e => set('estado', e.target.value)} placeholder="UF" />
                  </div>
                </div>

                {/* Município + Bairro */}
                <div className={styles.grid2} style={{ marginBottom: 16 }}>
                  <div className={styles.field}>
                    <label className={styles.label}>Município</label>
                    <input className={styles.input} value={form.municipio} onChange={e => set('municipio', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Bairro</label>
                    <input className={styles.input} value={form.bairro} onChange={e => set('bairro', e.target.value)} />
                  </div>
                </div>

                {/* Endereço + Número */}
                <div className={styles.grid3} style={{ marginBottom: 16 }}>
                  <div className={[styles.field, styles.span2].join(' ')}>
                    <label className={styles.label}>Endereço</label>
                    <input className={styles.input} value={form.endereco}
                      onChange={e => set('endereco', e.target.value)} placeholder="Rua / Av." />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Número</label>
                    <input className={styles.input} value={form.numero}
                      onChange={e => set('numero', e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Complemento</label>
                  <input className={styles.input} value={form.complemento}
                    onChange={e => set('complemento', e.target.value)} placeholder="Apto, Bloco..." />
                </div>

              </div>

              <div className={styles.footer}>
                <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={goNext}>
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* ══ STEP 2: Veículos ════════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <div className={styles.body}>
                <div className={styles.secRow}>
                  <SectionDiv icon={<Car size={12} />} label="Veículos" />
                  <button className={[styles.btn, styles.btnSm].join(' ')} onClick={addVeiculo}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <p className={styles.hint}>Opcional — adicione veículos se quiser que fiquem registrados.</p>

                {form.veiculos.length === 0 && (
                  <div className={styles.emptyVeiculos}>
                    <Car size={32} opacity={0.15} />
                    <span>Nenhum veículo adicionado</span>
                  </div>
                )}

                {form.veiculos.map((v, i) => (
                  <div key={i} className={styles.veiculoBlock}>
                    <div className={styles.veiculoHead}>
                      <Car size={13} className={styles.iconGold} />
                      <span>Veículo {i + 1}</span>
                      {v.placa && <span className={styles.placaBadge}>{v.placa}</span>}
                      <button className={styles.btnRemove} onClick={() => removeVeiculo(i)}><X size={12} /></button>
                    </div>
                    <div className={styles.grid3} style={{ marginBottom: 12 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>Modelo</label>
                        <input className={styles.input} value={v.modelo}
                          onChange={e => setVeiculo(i,'modelo',e.target.value)} placeholder="Ex: Civic" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Marca</label>
                        <Combobox value={v.marca} onChange={val => setVeiculo(i,'marca',val)}
                          options={MARCAS_VEICULO} placeholder="Ex: Honda" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Ano</label>
                        <Combobox value={v.ano} onChange={val => setVeiculo(i,'ano',val)}
                          options={ANOS_VEICULO} placeholder="Ex: 2024" />
                      </div>
                    </div>
                    <div className={styles.grid2}>
                      <div className={styles.field}>
                        <label className={styles.label}>Placa</label>
                        <input className={styles.input} value={v.placa}
                          onChange={e => setVeiculo(i,'placa',maskPlaca(e.target.value))}
                          placeholder="AAA0A00" maxLength={7} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Cor</label>
                        <Combobox value={v.cor} onChange={val => setVeiculo(i,'cor',val)}
                          options={CORES_VEICULO} placeholder="Ex: Preto" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.footer}>
                <button className={styles.btn} onClick={goBack}><ChevronLeft size={14} /> Voltar</button>
                <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={() => setStep(3)}>
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* ══ STEP 3: Confirmação ═════════════════════════════════════════════ */}
          {step === 3 && (
            <>
              <div className={styles.body}>
                <SectionDiv icon={<CheckCircle2 size={12} />} label="Confirme seus dados" />
                <p className={styles.hint} style={{ marginBottom: 20 }}>
                  {isEdit ? 'Seus dados serão atualizados com as informações abaixo.' : 'Revise antes de finalizar o cadastro.'}
                </p>

                <div className={styles.confirmCard}>
                  <div className={styles.confirmAvatar}>
                    {(form.nome || '?')[0].toUpperCase()}
                  </div>
                  <div className={styles.confirmInfo}>
                    <div className={styles.confirmName}>{form.nome || '—'}</div>
                    <div className={styles.confirmMeta}>
                      CPF: {form.cpf}
                      {form.dataNascimento && ` · Nasc: ${form.dataNascimento.toLocaleDateString('pt-BR')}`}
                    </div>
                    <div className={styles.confirmMeta}>{form.telefone} · {form.email}</div>
                    {form.cep && <div className={styles.confirmMeta}>{form.cep} — {[form.municipio, form.estado].filter(Boolean).join(', ')}</div>}
                  </div>
                  {isEdit && <span className={styles.editBadge}>Atualização</span>}
                </div>

                {form.veiculos.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p className={styles.confirmSubtitle}>Veículos</p>
                    {form.veiculos.map((v, i) => (
                      <div key={i} className={styles.confirmCard} style={{ marginTop: 8 }}>
                        <div className={styles.confirmAvatar} style={{ fontSize: 18 }}>🚗</div>
                        <div className={styles.confirmInfo}>
                          <div className={styles.confirmName}>{v.placa || '—'} · {[v.modelo, v.marca].filter(Boolean).join(' ') || '—'}</div>
                          <div className={styles.confirmMeta}>Ano: {v.ano || '—'} · Cor: {v.cor || '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.footer}>
                <button className={styles.btn} onClick={goBack} disabled={isSubmitting}>
                  <ChevronLeft size={14} /> Voltar
                </button>
                <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting
                    ? <><Loader2 size={13} className={styles.spin} /> Salvando...</>
                    : isEdit ? 'Confirmar Atualização' : 'Confirmar Cadastro'
                  }
                </button>
              </div>
            </>
          )}

          {/* ══ DONE ════════════════════════════════════════════════════════════ */}
          {step === 'done' && (
            <div className={styles.doneScreen}>
              <div className={styles.doneIcon}>✓</div>
              <h2 className={styles.doneTitle}>
                {isEdit ? 'Dados atualizados!' : 'Cadastro realizado!'}
              </h2>
              <p className={styles.doneText}>
                {isEdit
                  ? 'Suas informações foram atualizadas com sucesso.'
                  : 'Bem-vindo(a)! Seu cadastro foi registrado com sucesso.'}
              </p>
            </div>
          )}

        </div>{/* /card */}

        <div className={styles.brandCard}>
<div className={styles.brandInfo}>
            <span className={styles.brandName}>Isto É Pousada</span>
            <span className={styles.brandSub}>Referência na Baixada Maranhense</span>
            <a
              href="https://wa.me/5598988555038"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.brandPhone}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              (98) 98855-5038
            </a>
            <span className={styles.brandAddr}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              Rodovia MA014 KM38, N612
            </span>
          </div>
        </div>

      </div>{/* /wrap */}

      <Notif notif={notif} />
    </div>
  );
}

// ── Section Divider (local) ───────────────────────────────────────────────────
function SectionDiv({ icon, label }) {
  return (
    <div className={styles.secDiv}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
