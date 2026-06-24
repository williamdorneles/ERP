import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Limpando dados de clientes e produtos...')

  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn()
    console.log(`  ${label}: ${r.count}`)
  }

  await del('eventos NF-e',          () => prisma.eventoNFe.deleteMany())
  await del('itens NF-e',            () => prisma.itemNotaFiscal.deleteMany())
  await del('notas fiscais',         () => prisma.notaFiscal.deleteMany())
  await del('itens pedido compra',   () => prisma.itemPedidoCompra.deleteMany())
  await del('pedidos de compra',     () => prisma.pedidoCompra.deleteMany())
  await del('itens pedido venda',    () => prisma.itemPedidoVenda.deleteMany())
  await del('pedidos de venda',      () => prisma.pedidoVenda.deleteMany())
  await del('movimentações estoque', () => prisma.movimentacaoEstoque.deleteMany())
  await del('apontamentos',          () => prisma.apontamentoProducao.deleteMany())
  await del('ordens de produção',    () => prisma.ordemProducao.deleteMany())
  await del('produtos',              () => prisma.produto.deleteMany())
  await del('clientes/fornecedores', () => prisma.pessoa.deleteMany())

  console.log('\n✅ Concluído!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
