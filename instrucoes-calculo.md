# Instruções — Cálculo de Valor Total por Modalidade

## Contexto

Atualmente, o cálculo de `valor_total` do gado é feito sempre da mesma forma, assumindo a modalidade "arroba". Isso está incorreto: o negócio (`negocio.modalidade`) já suporta três modalidades diferentes (`"arroba"`, `"kg"`, `"cabeca"`), e cada uma delas exige uma fórmula de cálculo diferente para chegar no `valor_total` de cada gado.

Esta alteração precisa ser replicada em **dois lugares**, mantendo a lógica idêntica nos dois:
1. **Front-end**: no cálculo em tempo real exibido durante o cadastro de gado (feedback visual/"estimado")
2. **Backend (NestJS)**: no método `calcularValores`, que recalcula o valor de forma autoritativa antes de persistir no banco

## As três modalidades e suas fórmulas

### 1. Modalidade `"arroba"` (já implementada, mantém a lógica atual)

```
peso_calculo = peso_total * (rendimento_carcaca / 100)
peso_arroba  = ARREDONDAR_PARA_CIMA(peso_calculo / 15)
valor_total  = peso_arroba * valor_arroba
```

> **Atenção:** a implementação atual do backend calcula `valor_total = peso_calculo * peso_arroba` (peso multiplicado por peso), o que está incorreto — deveria ser `peso_arroba * valor_arroba` (peso multiplicado pelo valor monetário pago por arroba), como descrito acima. Corrigir isso como parte desta tarefa.

### 2. Modalidade `"kg"`

```
valor_total = valor_unidade * peso_total
```

Não usa `rendimento_carcaca`, `peso_calculo` nem `peso_arroba` — o cálculo é direto: o valor por quilo definido pelo usuário, multiplicado pelo peso total do animal.

### 3. Modalidade `"cabeca"`

```
valor_total = valor_unidade
```

O valor total é simplesmente o valor por unidade definido pelo usuário, independente do peso do animal — cada cabeça vale um valor fixo negociado.

## ⚠️ Ponto em aberto — nome do campo "valor por unidade"

O sistema hoje tem um campo `valor_arroba` (em `negocio`), usado apenas na modalidade "arroba". Para as modalidades "kg" e "cabeca", é necessário um campo equivalente representando "o valor por unidade definido pelo usuário" — mas não está claro se:

- (a) o mesmo campo `valor_arroba` deve ser reaproveitado de forma genérica para as três modalidades (guardando o valor por arroba, por kg, ou por cabeça, dependendo do contexto), ou
- (b) deveria existir um campo com nome mais genérico (ex: `valor_unidade`), com `valor_arroba` passando a ser só um caso específico dele.

**Instrução para o Claude Code:** por enquanto, reaproveitar o campo `valor_arroba` já existente como o "valor por unidade" nas três modalidades (fazendo a leitura semântica correta em cada cálculo, conforme as fórmulas acima), e deixar um comentário `// TODO: confirmar com o responsável pelo projeto se o campo deveria ser renomeado para algo mais genérico como valor_unidade, já que hoje seu nome sugere ser exclusivo da modalidade arroba`.

## Implementação no backend (NestJS)

Ajustar o método `calcularValores` para receber também a `modalidade` do negócio e ramificar o cálculo:

```typescript
private calcularValores(
  pesoTotal: number,
  rendimentoCarcaca: number,
  modalidade: 'arroba' | 'kg' | 'cabeca',
  valorUnidade: number,
): ValoresCalculados {
  switch (modalidade) {
    case 'arroba': {
      const peso_calculo = pesoTotal * (rendimentoCarcaca / 100);
      const peso_arroba = Math.ceil(peso_calculo / 15);
      const valor_total = peso_arroba * valorUnidade;
      return { peso_calculo, peso_arroba, valor_total };
    }
    case 'kg': {
      const valor_total = valorUnidade * pesoTotal;
      return { peso_calculo: 0, peso_arroba: 0, valor_total };
    }
    case 'cabeca': {
      const valor_total = valorUnidade;
      return { peso_calculo: 0, peso_arroba: 0, valor_total };
    }
    default:
      throw new BadRequestException(`Modalidade inválida: ${modalidade}`);
  }
}
```

> **Nota:** para as modalidades `"kg"` e `"cabeca"`, os campos `peso_calculo` e `peso_arroba` não se aplicam. Estou retornando `0` para manter a assinatura do tipo `ValoresCalculados` inalterada, mas avaliar se faz mais sentido tornar esses campos opcionais/nulos no banco (`peso_calculo` e `peso_arroba` como `NULL`) quando a modalidade não for "arroba", em vez de gravar `0`, que pode ser lido erroneamente como um valor real. Ajustar o schema do Prisma e a migration correspondente se essa for a direção escolhida.

Ajustar também o ponto onde `calcularValores` é chamado, passando `negocio.modalidade` e o valor de unidade correspondente (hoje `negocio.valor_arroba`, conforme a nota acima).

## Implementação no front-end

No componente de cadastro de gado, ramificar o cálculo em tempo real da mesma forma, usando a `modalidade` do negócio (já disponível via `negocio?.modalidade`):

```typescript
const pesoTotalRaw = useWatch({ control, name: "peso_total" });
const pesoTotal = Number(pesoTotalRaw) || 0;
const rendimentoCarcaca = negocio?.rendimento_carcaca ?? 0;
const valorUnidade = negocio?.valor_arroba ?? 0; // ver nota sobre nome do campo
const modalidade = negocio?.modalidade;

let pesoCalculoEstimado = 0;
let pesoArrobaEstimado = 0;
let valorEstimado = 0;

switch (modalidade) {
  case "arroba": {
    pesoCalculoEstimado = pesoTotal * (rendimentoCarcaca / 100);
    pesoArrobaEstimado =
      pesoCalculoEstimado > 0
        ? Math.ceil(pesoCalculoEstimado / KG_PER_ARROBA)
        : 0;
    valorEstimado = pesoArrobaEstimado * valorUnidade;
    break;
  }
  case "kg": {
    valorEstimado = valorUnidade * pesoTotal;
    break;
  }
  case "cabeca": {
    valorEstimado = valorUnidade;
    break;
  }
}
```

### Ajuste na exibição dos campos calculados

Como "Peso p/ Cálculo" e "Peso da Arroba" só fazem sentido na modalidade "arroba", esses campos devem ser **ocultados ou desabilitados** no formulário quando a modalidade do negócio for "kg" ou "cabeca" — exibir apenas "Valor Total (estimado)" nesses dois casos, já que os outros dois campos ficariam sempre zerados e sem significado para o usuário.

## Observações gerais para o Claude Code

- Manter a mesma regra de arredondamento (`Math.ceil`) já implementada para a modalidade "arroba" — isso não muda com esta tarefa, só está sendo formalizado junto das outras duas modalidades.
- Ao final da implementação, testar os três cenários manualmente (um negócio de cada modalidade) antes de considerar a tarefa concluída, e relatar qualquer ambiguidade adicional encontrada durante a implementação que não esteja coberta por este documento.
- Se o TODO sobre o nome do campo `valor_arroba`/`valor_unidade` for resolvido durante esta tarefa (por decisão do responsável pelo projeto), atualizar também o documento de instruções do backend gerado anteriormente (`instrucoes-backend-nestjs.md`) para refletir o nome definitivo do campo.