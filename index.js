const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1453126709447754010';
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_AVISOS_EQUIPE = '1476775424540282934';

client.once('ready', async () => {
    const commands = [{ name: 'setupsz', description: 'Painel de tickets (Tópicos)', default_member_permissions: PermissionFlagsBits.Administrator.toString() }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    // --- PAINEL /setupsz ---
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        const embed = new EmbedBuilder().setTitle('🎫 CENTRAL DE ATENDIMENTO').setDescription('Clique no botão ou use o menu para abrir um ticket por **TÓPICO PRIVADO**.').setColor('#2b2d31');
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_tkt').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success));
        const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('menu_cat').setPlaceholder('Escolha a categoria...').addOptions([{ label: 'BAN', value: 'ban' }, { label: 'AP', value: 'ap' }, { label: 'SIMU', value: 'simu' }]));
        await i.reply({ content: '✅ Painel enviado!', ephemeral: true });
        await i.channel.send({ embeds: [embed], components: [btn, menu] });
    }

    // --- ABERTURA DO TÓPICO PRIVADO ---
    if ((i.isButton() && i.customId === 'iniciar_tkt') || (i.isStringSelectMenu() && i.customId === 'menu_cat')) {
        const tipo = i.values?.[0] || 'geral';
        
        const thread = await i.channel.threads.create({
            name: `sz-${tipo}-${i.user.username}`,
            autoArchiveDuration: 60,
            type: ChannelType.PrivateThread,
            reason: `Ticket de ${i.user.tag}`
        });

        await thread.members.add(i.user.id);
        
        const menuOcorrido = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`ocorrido_${tipo}`).setPlaceholder('Qual o ocorrido?')
                .addOptions([{ label: 'Opção 1', value: 'op1' }, { label: 'Opção 2', value: 'op2' }, { label: 'Outro', value: 'outro' }])
        );

        await thread.send({ content: `👋 <@${i.user.id}> | <@&${ID_STAFF}>\nSelecione o ocorrido abaixo:`, components: [menuOcorrido] });
        await i.reply({ content: `✅ Tópico aberto: <#${thread.id}>`, ephemeral: true });
    }

    // --- FORMULÁRIO (MODAL) ---
    if (i.isStringSelectMenu() && i.customId.startsWith('ocorrido_')) {
        const modal = new ModalBuilder().setCustomId('modal_sz').setTitle('DETALHES');
        const qm = new TextInputBuilder().setCustomId('quem').setLabel("QUEM FOI?").setPlaceholder("Ex: @batata").setStyle(TextInputStyle.Short).setRequired(true);
        const rel = new TextInputBuilder().setCustomId('relato').setLabel("RELATO").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(qm), new ActionRowBuilder().addComponents(rel));
        return await i.showModal(modal);
    }

    // --- ENVIO PARA EQUIPE E LOGS ---
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_sz') {
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');
        const modo = i.channel.name.split('-')[1].toUpperCase();

        const embedEquipe = new EmbedBuilder()
            .setTitle(`🚨 DENÚNCIA: ${modo}`)
            .addFields({ name: '👤 Denunciador:', value: `<@${i.user.id}>` }, { name: '👤 Acusado:', value: quem }, { name: '📝 Relato:', value: relato })
            .setColor(modo === 'AP' ? '#ff0000' : '#f1c40f');

        const btnEquipe = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fechar_${i.channel.id}`).setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`dm_${i.user.id}`).setLabel('AVISAR RESOLVIDO').setStyle(ButtonStyle.Success)
        );

        const logChan = i.guild.channels.cache.get(CANAL_AVISOS_EQUIPE);
        const msgLog = await logChan.send({ embeds: [embedEquipe], components: [btnEquipe] });

        await i.reply({ content: '✅ Relato enviado! A Staff analisará o caso.', embeds: [embedEquipe] });
    }

    // --- BOTÕES DE COMANDO DA STAFF (NO CANAL DE LOGS) ---
    if (i.isButton()) {
        if (i.customId.startsWith('fechar_')) {
            const threadId = i.customId.split('_')[1];
            const thread = i.guild.channels.cache.get(threadId);

            // Apaga o Tópico e a Mensagem de Log
            if (thread) await thread.delete().catch(() => {});
            await i.message.delete().catch(() => {});
            await i.reply({ content: '✅ Ticket encerrado e log limpo!', ephemeral: true });
        }
        
        if (i.customId.startsWith('dm_')) {
            const userId = i.customId.split('_')[1];
            const user = await client.users.fetch(userId);
            await user.send('✅ Seu problema foi resolvido!').catch(() => {});
            await i.reply({ content: '✅ DM enviada!', ephemeral: true });
        }
    }
});

client.login(TOKEN);
