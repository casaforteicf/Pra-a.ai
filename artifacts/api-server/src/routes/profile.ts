import { Router, type IRouter } from "express";

const router: IRouter = Router();

let profile = {
  id: "user1",
  name: "Maria Oliveira",
  email: "maria.oliveira@email.com",
  phone: "(49) 99123-4567",
  avatarUrl: null,
  cpf: "***.***.***-45",
  addresses: [
    {
      id: "addr1",
      label: "Casa",
      street: "Rua das Missões",
      number: "456",
      complement: "Apto 12",
      neighborhood: "Centro",
      city: "Chapecó",
      state: "SC",
      zipCode: "89801-001",
      isDefault: true,
    },
    {
      id: "addr2",
      label: "Trabalho",
      street: "Avenida Getúlio Vargas",
      number: "1200",
      complement: "Sala 305",
      neighborhood: "Presidente Médici",
      city: "Chapecó",
      state: "SC",
      zipCode: "89803-001",
      isDefault: false,
    },
  ],
  orderCount: 12,
  favoriteCount: 7,
};

router.get("/profile", async (req, res): Promise<void> => {
  res.json(profile);
});

router.patch("/profile", async (req, res): Promise<void> => {
  const { name, phone, avatarUrl } = req.body;
  if (name !== undefined && name !== null) profile.name = name;
  if (phone !== undefined && phone !== null) profile.phone = phone;
  if (avatarUrl !== undefined && avatarUrl !== null) profile.avatarUrl = avatarUrl;
  res.json(profile);
});

export default router;
