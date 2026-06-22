-- Novo motivo de alteração de custo: entrada manual de estoque (movimentação)
ALTER TYPE "MotivoCusto" ADD VALUE IF NOT EXISTS 'MOVIMENTACAO_ESTOQUE';
