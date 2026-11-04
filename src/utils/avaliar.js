import InAppReview from 'react-native-in-app-review';
import { Platform } from 'react-native';

export function solicitarAvaliacaoGooglePlay() {
  if (Platform.OS !== 'android') return;

  InAppReview.isAvailable()
    .then((hasFlow) => {
      if (hasFlow) {
        InAppReview.RequestInAppReview()
          .then((result) => {
            console.log('Resultado da avaliação:', result);
          })
          .catch((error) => {
            console.log('Erro na avaliação:', error);
          });
      }
    })
    .catch((error) => {
      console.log('InAppReview indisponível:', error);
    });
}