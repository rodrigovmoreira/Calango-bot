import requests
import time
import sys

# ==========================================
# CONFIGURAÇÕES DO TESTE
# ==========================================
# Substitua pela URL da sua rota e pelo ID do seu negócio
BASE_URL = "http://localhost:3001/api/business/test/webhook" 
BUSINESS_ID = "698d22858f8e4151bddc90ce" 

# Um número falso (se quiser testar um novo contato toda vez, mude um dígito aqui)
NUMERO_TESTE = "5511999999001@c.us"

def chat(texto, descricao=""):
    """Envia a mensagem para o Node.js e imprime a resposta do Bot"""
    print(f"\n{'-'*50}")
    print(f"📍 ETAPA: {descricao.upper()}")
    print(f"👤 Você: {texto}")
    
    payload = {
        "from": NUMERO_TESTE,
        "body": texto,
        "businessId": BUSINESS_ID
    }
    
    print("⏳ Aguardando IA processar (Buffer Node + DeepSeek)...")
    
    try:
        # Aumentei o timeout para dar tempo da IA pensar com calma
        res = requests.post(BASE_URL, json=payload, timeout=90)
        
        if res.status_code == 200:
            resposta_bot = res.json().get('reply', '[Bot retornou mensagem vazia]')
            print(f"🤖 Bot : {resposta_bot}")
        else:
            print(f"❌ Erro do Servidor: {res.status_code} - {res.text}")
    except requests.exceptions.Timeout:
         print("❌ Erro: Tempo limite esgotado. A IA demorou muito.")
    except Exception as e:
        print(f"❌ Erro de Conexão: {e}")
        
    # O SEGREDO DO RITMO: Espera 8 segundos antes de iniciar o próximo passo do funil
    print("⏳ (Aguardando para simular tempo de digitação humana...)")
    time.sleep(12)

# ==========================================
# EXECUÇÃO DO ROTEIRO: FLUXO FELIZ (AGENDAMENTO)
# ==========================================
print("🚀 INICIANDO TESTE DE FLUXO FELIZ (AGENDAMENTO COM SUCESSO) 🚀")

# 1. O Início (Quebra-gelo)
chat("Oi, bom dia!", "Quebra-Gelo")

# 2. Identificação e Intenção Direta
chat("Meu nome é Carlos. Eu dei uma olhada no Instagram de vocês e queria agendar um horário.", "Identificação (Salvar Nome) e Intenção")

# 3. Pesquisa e Checagem de Agenda na mesma frase
chat("Queria agendar aquele serviço mais em conta que vocês têm. Vocês teriam um espaço amanhã às 10h da manhã?", "Pesquisa de Catálogo e Checagem de Agenda (Tool: check)")

# 4. A Confirmação do Agendamento
# Neste ponto, a IA já deve ter validado se amanhã às 10h está livre e dito o preço.
chat("Perfeito! Pode confirmar esse horário pra mim então, por favor.", "Ação de Agendamento (Tool: book)")

# 5. Dúvida Pós-Agendamento
chat("Tudo certo! Só pra eu me preparar, quais formas de pagamento vocês aceitam lá na hora?", "Dúvida Operacional")

# 6. Despedida
chat("Show de bola, muito obrigado! Até amanhã.", "Despedida")

print("\n✅ Teste E2E (Fluxo Feliz) Finalizado com Sucesso!")