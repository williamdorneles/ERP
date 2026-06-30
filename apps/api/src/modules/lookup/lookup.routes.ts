import type { FastifyInstance } from 'fastify'
import { requirePerfil } from '../../plugins/auth.plugin.js'

export interface EnderecoLookup {
  cep?: string
  logradouro?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigoIBGE?: string
}

interface ViaCepResp {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  ibge?: string
}

interface BrasilApiCnpjResp {
  razao_social?: string
  nome_fantasia?: string
  cep?: string | number
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  ddd_telefone_1?: string
  email?: string
}

// Consulta o CEP na ViaCEP e devolve o endereço normalizado (com código IBGE).
async function buscarCep(cepRaw: string): Promise<EnderecoLookup | null> {
  const cep = cepRaw.replace(/\D/g, '')
  if (cep.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    if (!r.ok) return null
    const d = (await r.json()) as ViaCepResp
    if (d.erro) return null
    return {
      cep,
      logradouro: d.logradouro || undefined,
      bairro: d.bairro || undefined,
      municipio: d.localidade || undefined,
      uf: d.uf || undefined,
      codigoIBGE: d.ibge || undefined,
    }
  } catch {
    return null
  }
}

export async function lookupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requirePerfil('ADMIN', 'GERENTE', 'VENDAS', 'FINANCEIRO', 'ESTOQUE', 'PRODUCAO'))

  // Endereço por CEP (ViaCEP)
  app.get('/cep/:cep', async (request, reply) => {
    const { cep } = request.params as { cep: string }
    const res = await buscarCep(cep)
    if (!res) return reply.code(404).send({ error: 'CEP não encontrado.' })
    return res
  })

  // Dados cadastrais por CNPJ (BrasilAPI/Receita) + IBGE do CEP retornado
  app.get('/cnpj/:cnpj', async (request, reply) => {
    const doc = (request.params as { cnpj: string }).cnpj.replace(/\D/g, '')
    if (doc.length !== 14) return reply.code(400).send({ error: 'CNPJ inválido.' })
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`)
      if (!r.ok) return reply.code(404).send({ error: 'CNPJ não encontrado na Receita.' })
      const d = (await r.json()) as BrasilApiCnpjResp
      const cep = d.cep ? String(d.cep).replace(/\D/g, '') : undefined
      const endViaCep = cep ? await buscarCep(cep) : null
      return {
        cnpj: doc,
        razaoSocial: d.razao_social || undefined,
        nomeFantasia: d.nome_fantasia || undefined,
        cep,
        logradouro: d.logradouro || endViaCep?.logradouro || undefined,
        numero: d.numero || undefined,
        complemento: d.complemento || undefined,
        bairro: d.bairro || endViaCep?.bairro || undefined,
        municipio: endViaCep?.municipio || d.municipio || undefined,
        uf: d.uf || endViaCep?.uf || undefined,
        codigoIBGE: endViaCep?.codigoIBGE || undefined,
        telefone: d.ddd_telefone_1 || undefined,
        email: d.email || undefined,
      }
    } catch {
      return reply.code(502).send({ error: 'Falha ao consultar a Receita. Tente novamente.' })
    }
  })
}
