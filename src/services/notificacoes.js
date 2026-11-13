// src/services/notificacoes.js
import notifee, { TriggerType, RepeatFrequency } from '@notifee/react-native';
import { NOTIFICACOES_CONFIG } from '../constants/notificacoesConfig';

// Solicitar permissão de notificação
export async function solicitarPermissaoNotificacao() {
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= 1;
  } catch (e) {
    console.log('Erro ao solicitar permissão de notificação:', e);
    return false;
  }
}

/**
 * Agenda uma notificação (seja semanal por dia/hora ou única por timestamp exato)
 */
export async function agendarNotificacaoDoSistema(chaveConfig, timestampPersonalizado = null) {
  const config = NOTIFICACOES_CONFIG[chaveConfig];
  if (!config) {
    console.log(`Configuração de notificação "${chaveConfig}" não encontrada.`);
    return;
  }

  const temPermissao = await solicitarPermissaoNotificacao();
  if (!temPermissao) return;

  try {
    // Remove o agendamento anterior com esse ID para evitar duplicatas
    await notifee.cancelNotification(config.idUnico);

    let dataAlvo;

    if (timestampPersonalizado) {
      dataAlvo = new Date(timestampPersonalizado);
    } else if (config.diaSemana !== undefined) {
      const agora = new Date();
      dataAlvo = new Date();
      dataAlvo.setHours(config.hora, config.minuto, 0, 0);

      let diasAteAlvo = config.diaSemana - agora.getDay();
      if (
        diasAteAlvo < 0 ||
        (diasAteAlvo === 0 &&
          (agora.getHours() > config.hora ||
            (agora.getHours() === config.hora && agora.getMinutes() >= config.minuto)))
      ) {
        diasAteAlvo += 7;
      }
      dataAlvo.setDate(agora.getDate() + diasAteAlvo);
    }

    if (!dataAlvo || dataAlvo.getTime() <= Date.now()) {
      console.log(`A data alvo para "${config.titulo}" já passou ou é inválida.`);
      return;
    }

    // Configuração do gatilho com alarme exato para o Android
    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: dataAlvo.getTime(),
      alarmManager: {
        exact: true,
      },
      ...(config.repetirSemanalmente && { repeatFrequency: RepeatFrequency.WEEKLY }),
    };

    const channelId = await notifee.createChannel({
      id: 'canal-padrao-app',
      name: 'Avisos e Lembretes',
      importance: 4,
    });

    await notifee.createTriggerNotification(
      {
        id: config.idUnico,
        title: config.titulo,
        body: config.corpo,
        android: {
          channelId,
          pressAction: { id: 'default' },
        },
      },
      trigger,
    );

    console.log(`Sucesso! Notificação "${config.titulo}" agendada para: ${dataAlvo.toLocaleString()}`);
  } catch (e) {
    console.log('Erro ao agendar notificação:', e);
  }
}