package domain

// The player and club names come from the actor (22 Oct 2026), so a card
// says who applied or answered.
func NewTeamApplicationReceived(recipientID, requestID, playerID string) NewNotification {
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindTeamApplication,
		ActorID:     playerID,
		Title:       "Yeni takım başvurusu",
		Body:        Actor + " takımına katılmak istiyor. Başvuruyu inceleyebilirsin.",
		ResourceID:  requestID,
		SourceKey:   "team-request:" + requestID + ":new",
	}
}

func NewTeamApplicationDecision(recipientID, requestID, clubID, decision string) NewNotification {
	title, body := "Takım başvurun yanıtlandı", Actor+" başvurunu reddetti. Diğer takımları inceleyip yeni bir başvuru gönderebilirsin."
	if decision == "accepted" {
		title, body = "Takım başvurun kabul edildi", Actor+" başvurunu kabul etti. Artık kadrosundasın."
	}
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindTeamApplication,
		ActorID:     clubID,
		Title:       title,
		Body:        body,
		ResourceID:  requestID,
		SourceKey:   "team-request:" + requestID + ":" + decision,
	}
}

func NewPaymentStatus(recipientID, orderID, sourceKey, status string) NewNotification {
	title, body := "Ödeme durumu güncellendi", "Başvuru haklarının ödeme durumu değişti."
	switch status {
	case "paid":
		title, body = "Ödemen onaylandı", "Satın aldığın takım başvuru hakları hesabına eklendi."
	case "failed":
		title, body = "Ödeme tamamlanamadı", "Bu sipariş için başvuru hakkı eklenmedi. Tekrar deneyebilirsin."
	case "refunded":
		title, body = "Ödeme iade edildi", "İade edilen siparişin başvuru hakları bakiyenden düşürüldü."
	}
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindPayment,
		Title:       title,
		Body:        body,
		ResourceID:  orderID,
		SourceKey:   sourceKey,
	}
}

func NewProPaymentStatus(recipientID, orderID, sourceKey, status string) NewNotification {
	title, body := "Ödeme durumu güncellendi", "Pro üyelik ödemenin durumu değişti."
	switch status {
	case "paid":
		title, body = "Pro üyeliğin açıldı", "Ödemen onaylandı; Pro süren 30 gün uzatıldı."
	case "failed":
		title, body = "Ödeme tamamlanamadı", "Pro üyelik bu sipariş için açılmadı. Tekrar deneyebilirsin."
	case "refunded":
		title, body = "Ödeme iade edildi", "İade edilen Pro süresi ve Pro hakları hesabından düşürüldü."
	}
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindPayment,
		Title:       title,
		Body:        body,
		ResourceID:  orderID,
		SourceKey:   sourceKey,
	}
}

func NewGiftReceived(recipientID, giftID, title string) NewNotification {
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindGift,
		Title:       "Yeni bir hediyen var",
		Body:        title + " hediyesi hesabına gönderildi. Hediyelerim ekranından alabilirsin.",
		ResourceID:  giftID,
		SourceKey:   "gift:" + giftID,
	}
}

func NewGameReward(recipientID, runID, gameName string) NewNotification {
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindGameReward,
		Title:       "Takım başvuru hakkı kazandın",
		Body:        gameName + " oyununu kazandın. Hakkın takım başvurularında hemen kullanılabilir.",
		ResourceID:  runID,
		SourceKey:   "game-reward:" + runID,
	}
}

func NewNewsReview(recipientID, articleID, title string, approved bool) NewNotification {
	n := NewNotification{
		RecipientID: recipientID,
		Kind:        KindNewsReview,
		Title:       "Haberin incelendi",
		Body:        "\u201c" + title + "\u201d haberin yayına alınmadı. Düzenleyip yeniden göndermek için kulüp ekranını kullanabilirsin.",
		ResourceID:  articleID,
		SourceKey:   "news-review:" + articleID,
	}
	if approved {
		n.Body = "\u201c" + title + "\u201d haberin onaylandı ve yayınlandı."
	}
	return n
}

func NewConnectionRequest(recipientID, requestID, senderID string) NewNotification {
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindConnection,
		ActorID:     senderID,
		Title:       "Yeni tanışma isteği",
		Body:        Actor + " seninle tanışmak istiyor. İstekler ekranından yanıtlayabilirsin.",
		ResourceID:  requestID,
		SourceKey:   "connection:" + requestID + ":new",
	}
}

func NewConnectionAccepted(recipientID, requestID, accepterID string) NewNotification {
	return NewNotification{
		RecipientID: recipientID,
		Kind:        KindConnection,
		ActorID:     accepterID,
		Title:       "Tanışma isteğin kabul edildi",
		Body:        Actor + " isteğini kabul etti. İletişim bilgisi artık Bağlantılarım ekranında.",
		ResourceID:  requestID,
		SourceKey:   "connection:" + requestID + ":accepted",
	}
}

func NewTournamentEntry(organizerID, entryID, clubID, tournamentName string) NewNotification {
	return NewNotification{
		RecipientID: organizerID,
		Kind:        KindTournament,
		ActorID:     clubID,
		Title:       "Yeni turnuva başvurusu",
		Body:        Actor + ", " + tournamentName + " turnuvasına başvurdu.",
		ResourceID:  entryID,
		SourceKey:   "tournament-entry:" + entryID + ":new",
	}
}

func NewTournamentDecision(clubID, entryID, tournamentName string, accepted bool) NewNotification {
	n := NewNotification{
		RecipientID: clubID,
		Kind:        KindTournament,
		Title:       "Turnuva başvurun yanıtlandı",
		Body:        tournamentName + " başvurun kabul edilmedi.",
		ResourceID:  entryID,
		SourceKey:   "tournament-entry:" + entryID + ":decision",
	}
	if accepted {
		n.Title = "Turnuvaya kabul edildin"
		n.Body = tournamentName + " başvurun kabul edildi. Takımın turnuvada."
	}
	return n
}
