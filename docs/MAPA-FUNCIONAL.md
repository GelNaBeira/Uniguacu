# Capa

## Mapa Funcional — Sistema de Almoxarifado Uniguaju Foz

**Data de geração:** 10 de novembro de 2026.  
**Finalidade:** referência funcional e técnica para a empresa e para manutenção futura.  
**Fontes exclusivas:** Relatório A — “Resultado da análise”; Relatório B — “Relatório comparativo”, apresentados nesta conversa.

**Aviso de escopo:** este documento se baseia em análise estática de código publicado e em uma captura de navegador descritas nos relatórios. Não houve execução do sistema para sua elaboração, consulta ao banco, acesso ao Console do Firebase ou inspeção do backend. Este mapa não substitui documentação do código-fonte, validação operacional ou auditoria de segurança.

**Convenções de evidência:**
- **[confirmado]**: informação explicitamente registrada nos relatórios, limitada aos artefatos examinados.
- **[inferido]**: interpretação de nomes, labels, caminhos ou relações descritas, sem confirmação integral do comportamento.
- **[desconhecido]**: informação não identificada nos relatórios ou que requer verificação externa.

O título solicitado usa “Uniguaju”. [confirmado] Os relatórios registram “Uniguacu” em nomes de arquivos e domínios e “Almoxarifado - Foz do Iguaçu” no título HTML. Essas grafias foram preservadas nas referências técnicas; a denominação institucional oficial requer verificação.

# Resumo executivo

[confirmado] O sistema disponibiliza telas para produtos, colaboradores, acadêmicos, chaves, carros, categorias, setores, fornecedores e usuários.  
[confirmado] Há recursos de empréstimo, devolução, consulta de disponibilidade e emissão de relatórios em PDF e Excel.  
[confirmado] A interface é Angular compilado, hospedado no Firebase Hosting, com autenticação Firebase e dados no Realtime Database, não Firestore.  
[confirmado] Há referências ao Firebase Storage e a um backend auxiliar na Vercel para exclusão de usuários.  
[confirmado] Foram identificadas 33 entradas de rotas e 13 nós principais de dados.  
[confirmado] A segunda captura acrescenta imagens, dependências visuais e uma Home renderizada, mas nenhum módulo Angular adicional identificado.  
[desconhecido] Não estão disponíveis código-fonte, regras de segurança, backend completo e esquema integral dos dados.  
[desconhecido] O funcionamento atual em produção e as permissões efetivas não foram validados.

# Visão geral da arquitetura

## Componentes e responsabilidades

| Componente | Papel no sistema | Evidência e limite |
|---|---|---|
| Firebase Hosting | Publicação do frontend | [confirmado] Site identificado pelo domínio `almoxarifado-uniguacu-foz.web.app`. Configuração de publicação desconhecida. |
| Frontend Angular compilado | Interface, navegação e chamadas a serviços | [confirmado] Bundle principal `main.54299da54589d177.js`, acompanhado de runtime e polyfills. |
| Firebase Authentication | Login e manutenção das credenciais | [confirmado] Login por e-mail/senha, recuperação, atualização de e-mail e senha e exclusão de conta. |
| Firebase Realtime Database | Persistência e observação dos dados | [confirmado] Uso de `database.list`, `database.object`, leituras e mutações. Não foram encontradas chamadas da aplicação ao Firestore. |
| Firebase Storage | Referência a armazenamento de arquivos | [confirmado] Exclusão por `storage().refFromURL(...).delete()`. Não há fluxo completo de upload documentado. |
| Backend auxiliar Vercel | Operação auxiliar de exclusão de usuário | [confirmado] Chamada DELETE ao endpoint `deleteUserFoz`. Implementação não recuperada. |

```text
Firebase Hosting ── entrega frontend Angular ──> Navegador
                                                   |
                     +-----------------------------+------------------+
                     |                  |                |             |
               Firebase Auth     Realtime Database    Storage     Backend Vercel
               credenciais       dados e observação   exclusão     deleteUserFoz
```

[confirmado] O projeto Firebase é identificado como `almoxarifado-uniguacu-foz`. O endereço do banco registrado é `https://almoxarifado-uniguacu-foz-default-rtdb.firebaseio.com`; o domínio de autenticação é `almoxarifado-uniguacu-foz.firebaseapp.com`. A configuração inclui chave de API, não reproduzida neste documento.

## Empacotamento e captura

[confirmado] Os dois conjuntos recuperados possuem o mesmo bundle principal, runtime, polyfills, CSS da aplicação e favicon, com igualdade por SHA-256. Os JavaScript adicionais da captura são Bootstrap e Font Awesome, não módulos de rotas identificados.

[inferido] O material é compatível com funcionalidades concentradas no bundle principal, sem lazy loading identificado nas capturas. **Não se deve transformar isso em garantia absoluta de ausência de lazy loading no sistema inteiro**: os relatórios não documentam todas as condições de navegação possíveis nem o projeto-fonte.

[confirmado] A captura da extensão contém componentes `app-navbar`, `app-side-bar`, `router-outlet` e `app-home`, além de tabelas e modais renderizados. [inferido] Ela representa a área Home. [desconhecido] Sua data operacional, os estados visíveis e a abrangência dos dados não foram estabelecidos.

[confirmado] A foto de perfil tem um fluxo que lê a imagem como Data URL e a grava em `Usuarios/{uid}/photo`. Portanto, a existência do Storage não significa que todas as imagens sejam armazenadas nele. [desconhecido] Outros usos do Storage não foram detalhados.

# Mapa de telas (rotas)

[confirmado] A configuração possui **33 entradas**, contando `/`, que redireciona para `/login`. Os propósitos abaixo são [inferido] a partir dos caminhos e textos de interface; não equivalem a uma validação de cada tela em execução.

| Caminho | Área | Propósito [inferido] | Observações |
|---|---|---|---|
| `/` | Entrada | Direcionar para a entrada do sistema | [confirmado] Redirecionamento para `/login`, com correspondência completa. |
| `/login` | Entrada | Autenticar e recuperar acesso | [confirmado] Há guarda e tratamento de usuário já autenticado. |
| `/home` | Entrada | Acompanhar e registrar empréstimos e devoluções | [confirmado] Guarda consulta autenticação, papel e permissão relacionada a empréstimos. |
| `/products` | Produtos | Listar, buscar e filtrar produtos | [confirmado] Guarda de rota; regra detalhada não documentada. |
| `/new-product` | Produtos | Cadastrar produto | [confirmado] Guarda de rota. |
| `/edit-product` | Produtos | Editar produto | [confirmado] Guarda de rota; seleção do registro desconhecida. |
| `/product-codes` | Produtos | Consultar e administrar códigos de barras | [confirmado] Guarda de rota. |
| `/collaborators` | Colaboradores | Listar colaboradores | [confirmado] Guarda de rota. |
| `/new-collaborator` | Colaboradores | Cadastrar colaborador | [confirmado] Guarda de rota. |
| `/edit-collab` | Colaboradores | Editar colaborador | [confirmado] Guarda de rota. |
| `/academics` | Acadêmicos | Listar acadêmicos | [confirmado] Guarda de rota. |
| `/new-academic` | Acadêmicos | Cadastrar acadêmico | [confirmado] Guarda de rota. |
| `/edit-academic` | Acadêmicos | Editar acadêmico | [confirmado] Guarda de rota. |
| `/keys` | Chaves | Consultar chaves e disponibilidade | [confirmado] Guarda de rota. |
| `/new-key` | Chaves | Cadastrar chave | [confirmado] Guarda de rota. |
| `/edit-key` | Chaves | Editar chave | [confirmado] Guarda de rota. |
| `/cars` | Carros | Consultar carros e disponibilidade | [confirmado] Guarda de rota. |
| `/new-car-key` | Carros | Cadastrar carro ou seu registro de chave | [confirmado] Textos usam “Novo Carro”; o caminho usa `car-key`. |
| `/edit-car-key` | Carros | Editar carro ou seu registro de chave | [confirmado] Textos usam “Editar Carro”. |
| `/categories` | Categorias | Listar categorias | [confirmado] Guarda de rota. |
| `/new-category` | Categorias | Cadastrar categoria | [confirmado] Guarda de rota. |
| `/edit-category` | Categorias | Editar categoria | [confirmado] Guarda de rota. |
| `/sectors` | Setores | Listar setores | [confirmado] Guarda de rota. |
| `/new-sector` | Setores | Cadastrar setor | [confirmado] Guarda de rota. |
| `/edit-sector` | Setores | Editar setor | [confirmado] Guarda de rota. |
| `/suppliers` | Fornecedores | Listar fornecedores | [confirmado] Guarda de rota. |
| `/new-supplier` | Fornecedores | Cadastrar fornecedor | [confirmado] Guarda de rota. |
| `/edit-supplier` | Fornecedores | Editar fornecedor | [confirmado] Guarda de rota. |
| `/perfil` | Conta | Alterar dados pessoais, senha e encerrar sessão/conta | [confirmado] Guarda de rota. |
| `/help` | Conta | Consultar manual de utilização | [confirmado] Guarda de rota; manual identificado nos textos. |
| `/admin` | Administração | Administrar usuários e consultar relatórios gerais | [confirmado] Exige papel `ADMIN` na guarda. |
| `/admin-create-user` | Administração | Cadastrar usuário e atribuir função/permissões | [confirmado] Exige papel `ADMIN` na guarda. |
| `/admin-edit-user` | Administração | Editar usuário e permissões | [confirmado] Exige papel `ADMIN` na guarda. |

[confirmado] Não foram encontradas rotas com parâmetro `/:id` nem rota curinga `**` nessa configuração. [desconhecido] Os relatórios não esclarecem se a edição usa query string, estado de navegação, serviço compartilhado ou outro mecanismo para identificar o registro.

# Modelo de dados

## Critérios de leitura

[confirmado] Os 13 nomes abaixo são **nós do Realtime Database**, não coleções do Firestore. A capitalização e a grafia devem ser preservadas. `{id}` e `{uid}` representam trechos variáveis dos caminhos; não são nomes de campos confirmados.

Um label de formulário confirma um conceito apresentado ao usuário, mas não comprova sua chave, tipo ou obrigatoriedade no banco. Os relatórios não permitem fornecer um esquema integral. Operações gerais como `.set`, `.update` e `.remove` foram identificadas, mas não devem ser atribuídas indiscriminadamente a todos os nós.

## Usuarios

- **Finalidade:** [confirmado] Perfis, papéis e permissões dos usuários da aplicação.
- **Campos conhecidos:** [confirmado] `email`, `name` e `photo`, inclusive nos caminhos `Usuarios/{uid}/email`, `/name` e `/photo`; `role` e `limitedAccess` aparecem nas verificações descritas. [inferido] A identificação apresentada no cadastro compõe os dados de usuário; sua chave persistida não foi informada.
- **Operações identificadas:** [confirmado] Escrita em `Usuarios/{uid}` com `.set`; atualização por `.list("Usuarios").update`; leitura individual por `.valueChanges`; listagem por `.snapshotChanges`; consulta por `email`; exclusão com `.remove`; alteração dos campos citados.
- **Observações:** [confirmado] Credenciais também são mantidas pelo Firebase Authentication, separadamente do perfil. [desconhecido] Não foi demonstrado que o cadastro e a remoção nas duas camadas sejam atômicos.

## Products

- **Finalidade:** [confirmado] Produtos, quantidades e códigos de barras associados.
- **Campos conhecidos:** [confirmado] `name`, usado em consulta; `qtd`, atualizado por caminho específico; `barCode`, associado ao produto. [inferido] Preço unitário, identificação da nota, descrição, categoria, setor e fornecedor correspondem a dados do formulário. Chaves, tipos e representação dessas relações não foram identificados.
- **Operações identificadas:** [confirmado] Listagem por `.snapshotChanges`, consulta por `name` com `orderByChild(...).equalTo(...)`, escrita da quantidade e atualização de disponibilidade dos códigos no fluxo de empréstimo. [inferido] As telas de cadastro e edição indicam manutenção do registro; as chamadas completas por ação não foram consolidadas nos relatórios.
- **Observações:** [confirmado] Não foi identificado nó independente `Barcodes`. [desconhecido] Estrutura interna de `barCode`, política de estoque e distinção persistida entre produto e consumível.

## Collaborators

- **Finalidade:** [confirmado] Cadastro de colaboradores, apresentados como possíveis participantes dos empréstimos.
- **Campos conhecidos:** [inferido] Nome, identificação, função e telefone, a partir dos labels. [desconhecido] As chaves e os tipos desses campos no nó não foram informados.
- **Operações identificadas:** [confirmado] O nó foi identificado entre os caminhos acessados pela aplicação. [inferido] Rotas e botões indicam consulta, cadastro, edição e exclusão; não há descrição suficiente para associar cada operação a uma chamada específica nesse nó.
- **Observações:** [desconhecido] Relação exata com `Usuarios`, possibilidade de um colaborador ter login e regras sobre vínculos não foram estabelecidas. Não se deve tratar os dois cadastros como equivalentes.

## Academics

- **Finalidade:** [confirmado] Cadastro de acadêmicos.
- **Campos conhecidos:** [inferido] Nome do acadêmico, identificação/RA e curso, pelos textos de formulário. [desconhecido] Chaves persistidas, tipos e validações completas.
- **Operações identificadas:** [confirmado] Nó identificado nas chamadas da aplicação. [inferido] As rotas de listagem, novo e edição indicam leitura e manutenção de registros. [desconhecido] Detalhamento das chamadas de gravação e exclusão.
- **Observações:** [inferido] O cadastro representa um público distinto de colaboradores. [desconhecido] Como essa distinção é persistida nos empréstimos e se existe relação com contas autenticadas.

## Keys

- **Finalidade:** [confirmado] Cadastro de chaves e sua disponibilidade.
- **Campos conhecidos:** [confirmado] `status`, no caminho `Keys/{id}/status`. [inferido] Nome da chave, pelos labels. “Disponível” e “Indisponível” são opções da interface; a codificação armazenada não foi informada.
- **Operações identificadas:** [confirmado] Acesso ao nó e caminho de status identificados. [inferido] Listagem, cadastro e edição pelas rotas; empréstimo e retorno tendem a alterar disponibilidade. [desconhecido] Sequência completa das mutações e condições para exclusão.
- **Observações:** [confirmado] O histórico de empréstimos de chaves é identificado separadamente em `KeyLend`. [desconhecido] Chave de relacionamento e garantias contra empréstimos simultâneos.

## CarKeys

- **Finalidade:** [confirmado] Registros de carros/chaves de carros usados na aplicação.
- **Campos conhecidos:** [confirmado] `status`, pelo caminho `CarKeys/{id}/status`. [inferido] Nome do carro e quilometragem atual, pelos formulários. [desconhecido] Nomes das chaves e tipos desses atributos.
- **Operações identificadas:** [confirmado] Nó e caminho de status identificados. [inferido] Consulta, cadastro e edição pelos caminhos de tela; atualização de disponibilidade associada aos empréstimos. Chamadas completas não foram descritas individualmente.
- **Observações:** [confirmado] Há diferença de nomenclatura entre rotas `car-key`, nó `CarKeys` e interface “Carro”. [desconhecido] Se o domínio representa veículo, chave ou ambos como uma única entidade.

## Categories

- **Finalidade:** [confirmado] Categorias usadas na classificação de produtos e em filtros/relatórios.
- **Campos conhecidos:** [inferido] Nome da categoria. [desconhecido] Demais atributos, chave persistida do nome e formato de relacionamento com produtos.
- **Operações identificadas:** [confirmado] Nó identificado. [inferido] Consulta, cadastro e edição pelas telas conhecidas; textos também oferecem confirmação de exclusão. O relatório não detalha todos os métodos chamados para esse cadastro.
- **Observações:** [desconhecido] Restrições de exclusão, tratamento de produtos vinculados e eventual propagação das alterações requerem verificação. Não presumir comportamento de integridade apenas pelos labels.

## Sectors

- **Finalidade:** [confirmado] Setores usados na classificação e nos filtros de produtos.
- **Campos conhecidos:** [inferido] Nome do setor. [desconhecido] Identificadores persistidos, atributos adicionais e obrigatoriedade do vínculo de produto.
- **Operações identificadas:** [confirmado] Nó identificado. [inferido] Leitura, cadastro e edição por suas rotas, além de ações de manutenção sugeridas pela interface. [desconhecido] Correspondência completa entre cada botão e uma mutação no banco.
- **Observações:** [confirmado] Existem filtros e relatório de setores. [desconhecido] Política de remoção de setor e efeitos sobre produtos ou históricos.

## Suppliers

- **Finalidade:** [confirmado] Cadastro de fornecedores, referenciados na interface de produtos e relatórios.
- **Campos conhecidos:** [inferido] Nome fantasia/apelido, razão social/nome, CPF/CNPJ, a partir dos labels. [desconhecido] Chaves, tipos e mecanismo de validação documental.
- **Operações identificadas:** [confirmado] Nó identificado. [inferido] Consulta, cadastro e edição pelas respectivas telas. [desconhecido] Métodos específicos de persistência, exclusão e comportamento sobre produtos vinculados.
- **Observações:** [desconhecido] O formato do relacionamento fornecedor–produto e a preservação histórica de alterações não foram estabelecidos. Os labels não comprovam validação de CPF/CNPJ no backend.

## Lendies

- **Finalidade:** [confirmado] Empréstimos de produtos, incluindo consumíveis.
- **Campos conhecidos:** [desconhecido] O relatório não fornece esquema persistido completo nem chaves suficientes para defini-lo. [inferido] Produto, colaborador/vínculo, quantidade, datas, horas, observação de saída, observação após devolução e condição sem devolução são conceitos representados na interface.
- **Operações identificadas:** [confirmado] Escrita de novo empréstimo em `Lendies/{id}` com `.set`. [inferido] Listagem e filtros dependem da leitura desses registros. [desconhecido] Chamadas exatas de atualização da devolução e exclusão.
- **Observações:** [confirmado] **`Lendies` é a grafia do código**. [desconhecido] Política de empréstimo parcial, relacionamento de códigos individuais e regras para consumíveis não foram descritos integralmente.

## KeyLend

- **Finalidade:** [confirmado] Histórico/registros de empréstimos de chaves.
- **Campos conhecidos:** [inferido] Chave, colaborador, datas e horas de empréstimo/devolução, observações e status, pelos conceitos de tela. [desconhecido] Chaves e formatos armazenados.
- **Operações identificadas:** [confirmado] Nó identificado entre os acessos. [inferido] Leitura para listagem/relatório e escrita/atualização para empréstimo e devolução. [desconhecido] Métodos específicos, sequência das gravações e política de exclusão.
- **Observações:** [confirmado] A interface oferece relatórios de chaves e filtros de disponibilidade. [desconhecido] Como o histórico se relaciona com `Keys` e como são impedidos conflitos de disponibilidade.

## CarKeyLend

- **Finalidade:** [confirmado] Registros de empréstimos de carros.
- **Campos conhecidos:** [inferido] Carro, colaborador, datas, horas, observações, quilometragem na retirada, quilometragem na entrega e distância percorrida. Esses termos vêm da interface, não de um esquema confirmado.
- **Operações identificadas:** [confirmado] Nó identificado. [inferido] Leitura para tabelas/relatórios e manutenção dos empréstimos. [desconhecido] Chamadas exatas de escrita, atualização e remoção.
- **Observações:** [desconhecido] Cálculo da distância, atualização da quilometragem do cadastro e validações de consistência não foram estabelecidos. A existência de um campo visual não comprova seu armazenamento ou recálculo.

## Operations

- **Finalidade:** [confirmado] Histórico de operações utilizado nos relatórios.
- **Campos conhecidos:** [confirmado] A expressão `operacao.key` participa da formação do caminho de gravação. Isso não prova que `key` seja persistido no conteúdo. [inferido] Operação, data, documento, produto, categoria, setor, fornecedor e valores aparecem no contexto dos relatórios; não constituem esquema confirmado deste nó.
- **Operações identificadas:** [confirmado] Escrita em `Operations/{operacao.key}` durante empréstimo e leitura por `.snapshotChanges` para relatórios. [desconhecido] Política completa de atualização, remoção e retenção.
- **Observações:** [desconhecido] Imutabilidade, cobertura de todas as ações e valor de auditoria formal. Um histórico funcional não deve ser presumido como trilha de auditoria inviolável.

# Papéis e permissões

## Papéis identificados

[confirmado] Foram identificados os valores `ADMIN` e `USER`, além de `limitedAccess`. Os textos da interface apresentam “Administrador”, “Usuário Comum” e “Permissões de Acesso”. [inferido] Esses labels correspondem aos papéis e ao conjunto de permissões empregado pela aplicação; o mapeamento integral não foi documentado.

[confirmado] As guardas de `/admin`, `/admin-create-user` e `/admin-edit-user` verificam `ADMIN`. A guarda de `/home` consulta o estado de autenticação e o perfil e considera os papéis e a permissão relacionada a “Empréstimos”. As demais telas têm guardas identificadas, mas o Relatório A não descreve individualmente o critério de cada uma.

[confirmado] O login consulta o papel e armazena `role` e `token` no armazenamento local do navegador. Há tratamento de navegação na rota de login para usuários autenticados. [desconhecido] O conjunto completo de consumidores desses valores e a duração de sua retenção não foram estabelecidos.

## Rotas, componentes e ações

[confirmado] Há interface para administrar usuários, mudar nome/e-mail/senha, excluir conta e sair. [inferido] Visibilidade de ações e formulários pode acompanhar o papel e as permissões. [desconhecido] Os relatórios não fornecem uma matriz completa de autorização por componente, botão, operação e nó do banco.

[desconhecido] Não foi identificado nos relatórios um catálogo completo dos valores possíveis de `limitedAccess`, sua regra padrão, o tratamento de valores ausentes ou quem pode alterar cada permissão. Também não foi confirmado uso de custom claims, vínculo entre empresas ou isolamento por unidade.

**Limite essencial:** [desconhecido] as Regras de Segurança do Firebase não foram verificadas. As verificações de rota e interface são controles do frontend; não demonstram, por si só, que uma leitura ou gravação será autorizada ou negada no servidor. O backend Vercel também precisa validar sua própria autorização.

# Fluxos principais

## Empréstimo de produto

1. [confirmado] A interface oferece seleção de produto e colaborador, quantidade, descrição de saída, datas, horas, indicação de código de barras e condição “Sem Devolução”.
2. [confirmado] Há mensagens como “Produto não encontrado”, “Quantidade Indisponível” e correspondência entre quantidade de códigos e itens. [desconhecido] As condições completas de disparo e a validação equivalente no servidor.
3. [confirmado] O fluxo grava o novo empréstimo em `Lendies/{id}` por `.set`.
4. [confirmado] Grava uma operação em `Operations/{operacao.key}` por `.set`.
5. [confirmado] Grava a nova quantidade em `Products/{produtoId}/qtd` por `.set`.
6. [confirmado] Há atualização da disponibilidade dos códigos de barras associados ao produto.
7. [desconhecido] Garantias de atomicidade, reversão após falhas, tratamento de concorrência e estado final de cada gravação não foram demonstrados nos relatórios.

```text
Formulário de empréstimo
          |
          +--> Lendies/{id}                    registro do empréstimo
          +--> Operations/{operacao.key}       registro de operação
          +--> Products/{produtoId}/qtd        nova quantidade
          +--> disponibilidade de códigos      quando aplicável
```

[inferido] A distribuição dessas gravações representa uma operação de negócio composta, envolvendo histórico e estoque. Não presumir que chamadas separadas constituam uma transação única. Para manutenção, alterações nesse fluxo precisam considerar a coerência entre os três nós e os códigos individuais.

## Devolução de produto

1. [confirmado] A interface apresenta “Confirmação de Devolução”, “Quantidade Devolvida”, “Itens Faltantes” e observações após devolução.
2. [confirmado] Existem estados visuais como “Em andamento”, “Atrasado”, “Devolvido/Finalizado” e “Sem devolução”.
3. [inferido] A confirmação atualiza informações do empréstimo e pode refletir devolução de itens e disponibilidade.
4. [desconhecido] Os relatórios não detalham as chamadas suficientes para afirmar quais campos mudam, como a quantidade volta ao estoque ou se uma operação é registrada em todos os casos.
5. [desconhecido] Devolução parcial, itens faltantes, reaproveitamento de códigos e tratamento dos consumíveis exigem validação do comportamento e das regras persistidas.

## Empréstimo de chaves e carros

1. [confirmado] Há telas, relatórios e filtros para chaves e carros, com cadastros em `Keys`/`CarKeys` e empréstimos em `KeyLend`/`CarKeyLend`.
2. [confirmado] Foram identificados os caminhos `Keys/{id}/status` e `CarKeys/{id}/status`.
3. [inferido] Um empréstimo relaciona o item ao responsável e ao período e modifica sua disponibilidade.
4. [confirmado] Para carros, a interface inclui quilometragem de retirada/entrega e distância percorrida, além de observações da devolução.
5. [desconhecido] A sequência exata de persistência, o registro correspondente em `Operations`, o cálculo de distância e as garantias contra empréstimos simultâneos não foram suficientemente descritos.

## Gestão de contas

1. [confirmado] O login usa e-mail/senha no Firebase Authentication, obtém token e consulta o perfil em `Usuarios`.
2. [confirmado] O cadastro chama a API `accounts:signUp`, enviando e-mail, senha e `returnSecureToken`; existe também escrita de perfil em `Usuarios`.
3. [confirmado] Recuperação de senha utiliza `sendPasswordResetEmail`; alterações de e-mail e senha usam métodos de Authentication.
4. [confirmado] Alteração de nome/e-mail/foto possui gravações em caminhos específicos de `Usuarios/{uid}`.
5. [confirmado] Há exclusão pelo backend auxiliar e caminhos de remoção do perfil/conta. [desconhecido] Não há documentação suficiente para afirmar uma sequência universal ou compensação em caso de erro.

# Dependências externas

| Dependência | Versão conhecida | Forma de carregamento/uso | Cópia local na extension |
|---|---|---|---|
| Bootstrap | [confirmado] 5.3.0 | Script por CDN jsDelivr no HTML original; bundle de componentes visuais | [confirmado] Sim, `bootstrap.bundle.min.js`, 80.421 bytes. |
| FastBootstrap | [confirmado] Caminho 2.2.0; comentário interno v2.1 | CSS por CDN jsDelivr | [confirmado] Sim, 396.646 bytes; divergência de identificação requer verificação. |
| Font Awesome — kit | [confirmado] Configuração 6.7.2 | Carregador externo que busca CSS e recursos dinamicamente | [confirmado] Loader de 16.569 bytes; recursos completos não capturados. |
| Font Awesome — CSS | [confirmado] 6.0.0-beta3 | Folha de estilos via cdnjs | [confirmado] CSS de 83.981 bytes; oito fontes referenciadas ausentes. |
| Firebase Auth, Realtime DB e Storage | [desconhecido] Versões não identificadas nos relatórios | SDK e chamadas do frontend; API REST também usada no cadastro de conta | [confirmado] Integrações presentes no bundle idêntico; serviços e dados não são cópias locais. |
| Backend Vercel | [desconhecido] Versão e tecnologia interna | Requisição DELETE ao endpoint auxiliar | [confirmado] Não há código do backend recuperado. |

## Endereços de integração

[confirmado] Cadastro de conta Firebase, com chave substituída por marcador:

`POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}`

[confirmado] Exclusão auxiliar de usuário:

`DELETE https://backend-almoxarifado.vercel.app/api/deleteUserFoz`

[confirmado] O corpo descrito dessa exclusão contém `{ uid, requesterUid }`. [desconhecido] A presença de outros controles, cabeçalhos ou validações no servidor não foi estabelecida.

[confirmado] O kit usa as bases `https://ka-f.fontawesome.com` e `https://kit.fontawesome.com`. [inferido] Seu construtor gera CSS sob `/releases/v6.7.2/css/`, com o arquivo principal e shims. Esses recursos são visuais, não endpoints de negócio do almoxarifado.

[confirmado] A captura contém ainda CSS associado ao Kaspersky. Ele não foi identificado como dependência funcional do sistema e não deve ser confundido com um módulo de negócio. [confirmado] Copiar as bibliotecas para disco, sem ajustar referências e obter recursos faltantes, não produz uma instalação integralmente offline.

# Segurança — o que sabemos e o que não sabemos

## Fatos confirmados

- [confirmado] A configuração Firebase, incluindo uma chave de API, está no bundle publicado. [inferido] Sua presença é compatível com configuração de cliente; **não comprova, isoladamente, vazamento de credencial privilegiada ou vulnerabilidade**. Os relatórios não avaliaram suas restrições.
- [confirmado] Há autenticação por e-mail/senha e verificações de papéis nas rotas.
- [confirmado] Papel e token são gravados no armazenamento local pelo fluxo de login descrito.
- [confirmado] Há endpoint auxiliar de exclusão de usuários na Vercel e chamadas de remoção de perfil/conta.
- [confirmado] Há alterações de estoque e histórico em caminhos distintos no empréstimo.
- [confirmado] O HTML capturado contém dados em tabelas; deve ser tratado como material potencialmente sensível, sem republicação indiscriminada.

## Pontos dependentes de verificação

[desconhecido] Não foram examinadas Regras de Segurança do Realtime Database ou do Storage. Não é possível afirmar quem pode ler dados pessoais, alterar estoque, atribuir `ADMIN`, modificar `limitedAccess`, apagar registros ou acessar arquivos diretamente. Também não se pode afirmar que essas operações estejam indevidamente abertas.

[desconhecido] A autorização no backend Vercel não foi recuperada. Receber `requesterUid` no corpo não demonstra que o servidor confie nele nem que valide sua identidade; ambas as conclusões exigiriam evidência adicional. É necessário verificar autenticação, autorização e tratamento de erros no backend real.

[desconhecido] Regras contra concorrência, integridade das quantidades, retenção do histórico e recuperação de gravações parciais não foram demonstradas. Esses são requisitos a conferir, não vulnerabilidades confirmadas.

## Verificações recomendadas

1. Conferir no Firebase as regras publicadas por ambiente e testar, de forma autorizada, cenários anônimo, `USER` e `ADMIN`, incluindo acesso direto aos nós.
2. Verificar quem pode modificar `Usuarios/{uid}/role` e `limitedAccess` e quais mecanismos impedem elevação indevida de privilégios.
3. Revisar no backend Vercel a validação de identidade e autorização para exclusão, sem assumir confiança em dados fornecidos pelo cliente.
4. Validar restrições da configuração Firebase, gestão de sessão, tratamento de tokens e práticas de proteção contra scripts indevidos no frontend.
5. Conferir consistência e recuperação dos fluxos compostos de estoque, políticas de backup e retenção, e acesso a fotos/documentos.
6. Restringir o compartilhamento do HTML capturado e conferir quais dados precisam ser anonimizados antes de uso em documentação ou testes.

**Conclusão de segurança:** [desconhecido] não é possível descartar problemas sem acesso autorizado ao Console do Firebase e à implementação Vercel. Os relatórios não comprovam vulnerabilidade e não constituem teste de invasão.

# Lacunas conhecidas

- **Código-fonte Angular:** [desconhecido] Componentes originais, serviços, interfaces, testes, dependências e configuração de build não foram recuperados. O bundle não substitui um repositório de manutenção.
- **Source maps:** [confirmado] Nenhum `.map` foi encontrado nas duas pastas; há somente referências ausentes em bibliotecas de terceiros. [desconhecido] Disponibilidade de mapas em outro local.
- **Backend Vercel:** [desconhecido] Código, framework, autenticação interna, variáveis de ambiente, implantação e demais endpoints não identificados nos relatórios.
- **Regras Firebase:** [desconhecido] Políticas do Realtime Database e Storage, índices necessários e configuração efetiva de autorização.
- **Configuração de deploy:** [confirmado] Nenhum `firebase.json`, `manifest.json` ou `ngsw.json` recuperado. [desconhecido] Rewrites, cabeçalhos, ambientes e processo de publicação.
- **Esquema completo dos dados:** [desconhecido] Chaves, tipos, obrigatoriedade, relações, índices, migrações e políticas de remoção não estão integralmente documentados.
- **Recursos visuais:** [confirmado] Faltam fontes referenciadas pelo Font Awesome e recursos carregados dinamicamente. [desconhecido] Completude de outros assets e conteúdo não visitado.
- **Operação real:** [desconhecido] Comportamento atual em produção, abrangência dos relatórios e fidelidade de todas as telas. A captura renderizada cobre a Home, não toda a navegação.
- **Manutenção e continuidade:** [desconhecido] Titularidade de contas, responsáveis, backups, monitoramento e procedimento de restauração não foram identificados nos relatórios.

# Glossário

- **Angular:** framework utilizado para construir a interface e organizar a aplicação no navegador.
- **Frontend:** parte do sistema entregue ao navegador, responsável pela apresentação e interação.
- **Backend:** serviço executado no servidor para processar operações e aplicar regras próprias.
- **Bundle:** arquivo que reúne código compilado da aplicação e, conforme o build, bibliotecas.
- **Minificação:** redução do código publicado, removendo formatação e encurtando identificadores.
- **Build:** processo que transforma o projeto-fonte em arquivos publicáveis.
- **Runtime:** código de suporte ao carregamento e execução do programa compilado.
- **Polyfill:** implementação de compatibilidade para recursos de plataforma.
- **Source map:** arquivo que relaciona o código compilado ao código-fonte original.
- **Lazy loading:** carregamento de partes do código apenas quando uma área ou recurso é necessário.
- **Chunk:** parte separada do código gerada pelo empacotamento, eventualmente carregada sob demanda.
- **Rota:** caminho de navegação associado a uma tela ou comportamento.
- **Guarda de rota:** verificação do frontend usada para permitir ou redirecionar a navegação.
- **Firebase Hosting:** serviço de hospedagem dos arquivos publicados do frontend.
- **Firebase Authentication:** serviço de identificação de usuários e gestão de credenciais.
- **Realtime Database:** banco Firebase organizado em árvore de dados e observado por clientes.
- **Firestore:** outro banco Firebase, distinto do Realtime Database; não identificado como usado pela aplicação.
- **Storage:** serviço de armazenamento de arquivos, separado dos registros do banco.
- **Nó:** posição nomeada na árvore do Realtime Database.
- **UID:** identificador de usuário empregado na integração com Authentication e perfis.
- **Endpoint:** endereço de uma operação disponibilizada por um serviço.
- **SDK:** biblioteca usada pela aplicação para acessar funcionalidades de um serviço.
- **API REST:** interface HTTP que permite solicitar operações usando métodos e endereços.
- **CDN:** rede de distribuição usada para entregar arquivos externos, como scripts e CSS.
- **DOM:** estrutura de elementos HTML que representa o documento no navegador.
- **Data URL:** representação de conteúdo incorporado em uma string, como imagem codificada.
- **Label:** texto de identificação de um campo ou opção da interface.
- **Placeholder:** texto de exemplo ou orientação exibido dentro de um campo.
- **Shim:** camada de compatibilidade, como os ajustes para versões antigas de ícones.
- **SHA-256:** função de hash empregada nos relatórios para comparar a identidade de arquivos.
- **Offset:** posição de um caractere no conteúdo do arquivo, contada a partir de zero.
- **Atomicidade:** garantia de que uma operação composta ocorre integralmente ou não ocorre.
- **Regras de Segurança:** políticas no serviço Firebase que controlam acesso e validação de dados.
- **Custom claims:** atributos de autorização associados a tokens de autenticação, cujo uso aqui é desconhecido.

# Anexos

## Anexo A — Inventário de arquivos recuperados

[confirmado] Inventário resumido do Relatório B. Tamanhos em bytes. **W** representa `C:\Projetos\almoxarifado-uniguacu-foz.web.app\`; **E**, `C:\Projetos\almoxarifado-extension\`. Em E, **H** representa a subpasta `almoxarifado-uniguacu-foz-web-app\`. Os caminhos da tabela são relativos a essas bases.

| Arquivo ou correspondência | Presença | W / E, bytes | Observação |
|---|---|---:|---|
| W: `main.54299da54589d177.js`; E: `H\main.54299da54589d177.js` | Ambas | 3.034.916 / 3.034.916 | Idêntico por SHA-256. |
| W: `polyfills.64716f3d04587d09.js`; E: `H\polyfills.64716f3d04587d09.js` | Ambas | 33.843 / 33.843 | Idêntico. |
| W: `runtime.83168ac503771365.js`; E: `H\runtime.83168ac503771365.js` | Ambas | 1.452 / 1.452 | Idêntico. |
| `cdn-jsdelivr-net\npm\bootstrap@5.3.0\dist\js\bootstrap.bundle.min.js` | E | — / 80.421 | Biblioteca externa. |
| `kit-fontawesome-com\1d87c7c99e.js` | E | — / 16.569 | Loader de ícones. |
| W: `styles.1f11d3205e37f414.css`; E: `H\styles.1f11d3205e37f414.css` | Ambas | 225.056 / 225.056 | Idêntico. |
| `cdn-jsdelivr-net\npm\fastbootstrap@2.2.0\dist\css\fastbootstrap.min.css` | E | — / 396.646 | CSS de terceiros. |
| `cdnjs-cloudflare-com\ajax\libs\font-awesome\6.0.0-beta3\css\all.min.css` | E | — / 83.981 | Fontes não incluídas. |
| `gc-kis-v2-scr-kaspersky-labs-com\E3E8934C-235A-4B0E-825A-35A08381A191\abn\main.css` | E | — / 216.598 | Associado ao Kaspersky. |
| `index.html` | Ambas | 22.356 / 463.826 | Inicial em W; renderizado em E. |
| W: `favicon.ico`; E: `H\favicon.ico` | Ambas | 7.992 / 7.992 | Idêntico. |
| `H\assets\images\deault-avatar.png` | E | — / 4.435 | Avatar padrão. |
| `H\assets\images\logoUniguacu.png` | E | — / 12.896 | Logotipo. |
| `robots.txt` | W | 22.356 / — | Idêntico ao HTML inicial de W. |
| **Totais** | **W: 7; E: 13 arquivos** | **3.347.971 / 4.578.631** | Sem `.json`, `.map` ou fontes. |

[confirmado] O Relatório B recomenda aproveitar seletivamente as duas imagens, manter o HTML renderizado como captura separada e não sobrescrever os arquivos idênticos nem o `index.html` inicial. Bibliotecas locais são opcionais para um trabalho futuro de ajuste das referências. O CSS do Kaspersky não deve ser incorporado como dependência da aplicação.

## Anexo B — Referências internas

[confirmado] Os offsets abaixo foram citados no Relatório A e se referem a `main.54299da54589d177.js`, originalmente em uma única linha. São posições de caracteres contadas a partir de zero, não números de linha nem offsets de bytes. Não foram recalculados para este documento.

| Offset ou intervalo | Assunto descrito no Relatório A |
|---|---|
| Próximo de `433831` | Configuração `Vs_firebaseConfig`, identificação do projeto e endereço do banco. |
| `1744579–1751618` | Configuração das 33 entradas de rotas. |
| `528194–529455` | Escrita, atualização, consulta e listagem de usuários. |
| `528798` | Cadastro via API REST Firebase Authentication, `accounts:signUp`. |
| `530988–534116` | Login e manutenção de conta, incluindo recuperação de senha. |
| `530804` | Exclusão de imagem por referência de URL no Firebase Storage. |
| `533388–533561` | Alteração da foto e gravação no perfil do Realtime Database. |
| `527724` | Definição do endereço auxiliar Vercel de exclusão de usuário. |
| `529091` | Método que chama o backend de exclusão de usuário. |
| Próximo de `541544` | Fluxo de empréstimo com gravações em `Lendies`, `Operations` e quantidade de `Products`. |
| `588350–588790` | Consulta de produto por nome e listagem de produtos. |
| `1519071–1519606` | Acesso a `Operations` no contexto dos relatórios. |

[confirmado] Fontes documentais internas: **A — “Resultado da análise”**, para rotas, integrações, nós e textos; **B — “Relatório comparativo”**, para inventário, identidade dos arquivos, recursos adicionais e lacunas. [desconhecido] Não foram informados identificadores de versão do código-fonte ou datas originais de publicação; este documento deve acompanhar futuras revisões sem assumir que o sistema em produção permanece igual aos artefatos relatados.