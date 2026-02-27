const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const TOKEN = 'SEU_TOKEN_AQUI';
const ID_STAFF = '1453126709447754010';
const ID_CATEGORIA = '1465842384586670254'; 

client.once('ready', () => console.log(`🚀 Ticket-SZ Online: ${client.user.tag}`));

// Comando para postar o painel inicial (Digite !setup no canal)
client.on('messageCreate', async (msg) => {
    if (msg.content === '!setup' && msg.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE TICKETS - ALPHA')
            .setDescription('Selecione a categoria do seu problema abaixo para abrir um chamado.')
            .setColor('#2b2d31');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_categoria')
                .setPlaceholder('Escolha a categoria...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'cat_ban', emoji: '🔨' },
                    { label: 'FALHA EM AP', value: 'cat_ap', emoji: '💰' },
                    { label: 'FALHA EM SIMU', value: 'cat_simu', emoji: '🏆' }
                ])
        );

        await msg.channel.send({ embeds: [embed], components: [menu] });
        msg.delete();
    }
});

client.on('interactionCreate', async (i) => {
    // 1. Criação do Canal ao selecionar categoria
    if (i.isStringSelectMenu() && i.customId === 'menu_categoria') {
        const tipo = i.values[0];
        const nomeCanal = `sz-${tipo.replace('cat_', '')}-${i.user.username}`;

        const canal = await i.guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            parent: ID_CATEGORIA,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ID_STAFF, allow: [PermissionFlagsBits.ViewChannel] }
            ]
        });

        const embedTkt = new EmbedBuilder()
            .setTitle(`📩 ATENDIMENTO: ${tipo.replace('cat_', '').toUpperCase()}`)
            .setDescription(`Olá ${i.user}, selecione o **OCORRIDO** no menu abaixo.\n\n📩 *Levaremos a situação para equipe, pode ser que entremos em contato.*`)
            .setColor('#5865F2');

        let opcoes = [];
        if (tipo === 'cat_ban') {
            opcoes = [
                { label: 'Xingamento', value: 'xingamento' },
                { label: 'Mídia Inapropriada', value: 'midia' },
                { label: 'Ameaça', value: 'ameaca' },
                { label: 'Outro', value: 'outro_ban' }
            ];
        } else if (tipo === 'cat_ap') {
            opcoes = [
                { label: 'Vitória Errada', value: 'vit_errada_ap' },
                { label: 'Pagamento Errado ou não efetuado', value: 'pag_errado' },
                { label: 'Desrespeito', value: 'outro_ap' }
            ];
        } else {
            opcoes = [
                { label: 'Vitória Errada', value: 'vit_errada_simu' },
                { label: 'Favoritismo', value: 'favoritismo' },
                { label: 'Desrespeito', value: 'outro_simu' }
            ];
        }

        const menuOcorrido = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`ocorrido_${tipo}`)
                .setPlaceholder('Qual foi o ocorrido?')
                .addOptions(opcoes)
        );

        await canal.send({ content: `${i.user} | <@&${ID_STAFF}>`, embeds: [embedTkt], components: [menuOcorrido] });
        await i.reply({ content: `✅ Ticket criado: ${canal}`, ephemeral: true });
    }

    // 2. Abrir Modal (Formulário) ao selecionar ocorrido
    if (i.isStringSelectMenu() && i.customId.startsWith('ocorrido_')) {
        const escolha = i.values[0];
        const modal = new ModalBuilder().setCustomId('modal_detalhes').setTitle('DETALHES DO OCORRIDO');
        
        const qmInput = new TextInputBuilder()
            .setCustomId('quem')
            .setLabel("QUEM FOI?")
            .setPlaceholder(escolha.includes('ap') || escolha.includes('simu') ? "Ex: @picles" : "Ex: @batata")
            .setStyle(TextInputStyle.Short).setRequired(true);

        const descInput = new TextInputBuilder()
            .setCustomId('relato')
            .setLabel("EXPLIQUE O OCORRIDO")
            .setStyle(TextInputStyle.Paragraph).setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(qmInput), new ActionRowBuilder().addComponents(descInput));
        return await i.showModal(modal);
    }

    // 3. Receber Modal e finalizar
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_detalhes') {
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');

        const embedFinal = new EmbedBuilder()
            .setTitle('📝 RELATÓRIO DE DENÚNCIA')
            .addFields(
                { name: '👤 Acusado:', value: quem, inline: true },
                { name: '📝 Relato:', value: relato }
            )
            .setColor('#f1c40f')
            .setFooter({ text: '📩 Levaremos a situação para equipe, pode ser que entremos em contato.' });

        const btnFechar = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fechar_tkt').setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger)
        );

        await i.reply({ embeds: [embedFinal], components: [btnFechar] });
    }

    // 4. Fechar Ticket
    if (i.isButton() && i.customId === 'fechar_tkt') {
        await i.reply('🔒 O ticket será deletado em 5 segundos...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
